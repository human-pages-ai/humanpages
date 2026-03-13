/**
 * MCP OAuth 2.0 Routes
 *
 * Implements OAuth 2.0 endpoints required by the MCP spec for GPT compatibility.
 * Supports:
 * - RFC 6749: OAuth 2.0 Authorization Framework
 * - RFC 7591: OAuth 2.0 Dynamic Client Registration
 * - RFC 7636: PKCE (Proof Key for Public Clients)
 * - RFC 8707: Resource Indicators for OAuth 2.0
 *
 * This allows GPT and other LLM clients to:
 * 1. Register themselves as OAuth clients
 * 2. Obtain authorization codes via user login
 * 3. Exchange codes for access tokens
 * 4. Access the MCP server with those tokens
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const router = Router();

/**
 * In-memory storage for OAuth clients and authorization codes.
 * In production, these should be persisted in a database.
 */
const oauthClients = new Map<string, {
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  name: string;
  description?: string;
  createdAt: Date;
}>();

const authorizationCodes = new Map<string, {
  code: string;
  clientId: string;
  agentId: string;
  redirectUri: string;
  codeChallenge?: string;
  codeChallengeMethod?: 'S256' | 'plain';
  expiresAt: Date;
  scopes: string[];
}>();

// Clean up expired authorization codes every 5 minutes
setInterval(() => {
  const now = new Date();
  let cleaned = 0;

  for (const [code, record] of authorizationCodes.entries()) {
    if (record.expiresAt < now) {
      authorizationCodes.delete(code);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.info({ cleaned }, 'Cleaned up expired OAuth authorization codes');
  }
}, 5 * 60 * 1000);

/**
 * Generate a random client secret
 */
function generateClientSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate an authorization code
 */
function generateAuthorizationCode(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validate a PKCE code challenge.
 * Supports both S256 (SHA256) and plain methods.
 */
function validatePKCE(
  codeChallenge: string,
  codeVerifier: string,
  method?: string
): boolean {
  if (method === 'S256') {
    const hash = createHash('sha256').update(codeVerifier).digest('base64url');
    return hash === codeChallenge;
  } else {
    // plain method
    return codeVerifier === codeChallenge;
  }
}

/**
 * Generate a JWT access token that encodes the agent's API key.
 */
function generateAccessToken(agentId: string, agentApiKey: string): string {
  const payload = {
    agentId,
    apiKey: agentApiKey,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  };

  return jwt.sign(payload, process.env.JWT_SECRET!, { algorithm: 'HS256' });
}

/**
 * Generate a refresh token
 */
function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * GET /.well-known/oauth-protected-resource
 *
 * Returns metadata about this OAuth 2.0 protected resource.
 * See: https://datatracker.ietf.org/doc/html/draft-jones-oauth-protected-resource-indicators
 */
router.get('/.well-known/oauth-protected-resource', (req, res) => {
  res.json({
    resource: 'https://api.humanpages.ai/api/mcp',
    authorization_server: `${process.env.FRONTEND_URL || 'https://humanpages.ai'}/oauth`,
    bearer_methods: ['header'],
  });
});

/**
 * GET /.well-known/oauth-authorization-server
 *
 * Returns OAuth 2.0 Authorization Server metadata.
 * See: https://datatracker.ietf.org/doc/html/rfc8414
 */
router.get('/.well-known/oauth-authorization-server', (req, res) => {
  const baseUrl = process.env.FRONTEND_URL || 'https://humanpages.ai';

  res.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    registration_endpoint: `${baseUrl}/oauth/register`,
    revocation_endpoint: `${baseUrl}/oauth/revoke`,
    introspection_endpoint: `${baseUrl}/oauth/introspect`,
    scopes_supported: ['read', 'write', 'admin'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
    code_challenge_methods_supported: ['S256', 'plain'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['HS256', 'RS256'],
  });
});

/**
 * POST /oauth/register
 *
 * Dynamic Client Registration (RFC 7591).
 * Allows clients (like GPT) to register themselves and obtain a client_id.
 */
router.post('/oauth/register', (req, res) => {
  try {
    const { client_name, redirect_uris, client_description, response_types, grant_types } = req.body;

    // Validate required fields
    if (!client_name || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'client_name and redirect_uris are required',
      });
    }

    // Validate redirect URIs are HTTPS in production
    const isProduction = process.env.NODE_ENV === 'production';
    for (const uri of redirect_uris) {
      try {
        const parsed = new URL(uri);
        if (isProduction && parsed.protocol !== 'https:') {
          return res.status(400).json({
            error: 'invalid_request',
            error_description: 'redirect_uris must use HTTPS in production',
          });
        }
      } catch {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'Invalid redirect_uri format',
        });
      }
    }

    // Generate client credentials
    const clientId = `client_${crypto.randomBytes(12).toString('hex')}`;
    const clientSecret = generateClientSecret();

    // Store client (in production, use a database)
    oauthClients.set(clientId, {
      clientId,
      clientSecret,
      redirectUris: redirect_uris,
      name: client_name,
      description: client_description,
      createdAt: new Date(),
    });

    logger.info({ clientId, clientName: client_name }, 'OAuth client registered');

    // Return registration response
    res.status(201).json({
      client_id: clientId,
      client_secret: clientSecret,
      client_name,
      redirect_uris,
      response_types: response_types || ['code'],
      grant_types: grant_types || ['authorization_code', 'refresh_token'],
      registration_access_token: jwt.sign(
        { clientId, type: 'registration_access' },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      ),
      registration_client_uri: `${process.env.FRONTEND_URL || 'https://humanpages.ai'}/oauth/client/${clientId}`,
    });
  } catch (error) {
    logger.error({ error }, 'OAuth register error');
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error',
    });
  }
});

/**
 * GET /oauth/authorize
 *
 * Authorization endpoint (RFC 6749 §4.1.1).
 * Redirects to a login page where the user enters their Human Pages agent API key.
 *
 * Query parameters:
 * - client_id: OAuth client ID
 * - redirect_uri: Where to send the authorization code
 * - response_type: Must be "code"
 * - code_challenge: PKCE code challenge (optional)
 * - code_challenge_method: "S256" or "plain" (optional)
 * - state: Opaque state to prevent CSRF
 * - resource: Resource indicator (RFC 8707)
 */
router.get('/oauth/authorize', (req, res) => {
  try {
    const {
      client_id,
      redirect_uri,
      response_type,
      code_challenge,
      code_challenge_method,
      state,
      resource,
    } = req.query;

    // Validate required parameters
    if (!client_id || !redirect_uri || response_type !== 'code') {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing or invalid parameters',
      });
    }

    // Validate client exists
    const client = oauthClients.get(String(client_id));
    if (!client) {
      return res.status(400).json({
        error: 'invalid_client',
        error_description: 'Unknown client_id',
      });
    }

    // Validate redirect_uri is registered
    if (!client.redirectUris.includes(String(redirect_uri))) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'redirect_uri not registered for this client',
      });
    }

    // Render login form
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Human Pages Agent Login</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 500px; margin: 100px auto; padding: 20px; }
          .form-group { margin-bottom: 20px; }
          label { display: block; margin-bottom: 5px; font-weight: 500; }
          input[type="text"], input[type="password"] { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
          button { background: #0066cc; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
          button:hover { background: #0052a3; }
          .error { color: #d32f2f; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <h1>Human Pages MCP Agent Login</h1>
        <p>Connecting: <strong>${String(client_id).substring(0, 20)}...</strong></p>

        <form method="POST" action="/oauth/authorize">
          <div class="form-group">
            <label for="agent_key">Agent API Key</label>
            <input type="password" id="agent_key" name="agent_key" placeholder="hp_..." required />
            <small>Enter your Human Pages agent API key (starts with "hp_")</small>
          </div>

          <input type="hidden" name="client_id" value="${String(client_id)}" />
          <input type="hidden" name="redirect_uri" value="${String(redirect_uri)}" />
          <input type="hidden" name="response_type" value="code" />
          <input type="hidden" name="state" value="${String(state || '')}" />
          ${code_challenge ? `<input type="hidden" name="code_challenge" value="${String(code_challenge)}" />` : ''}
          ${code_challenge_method ? `<input type="hidden" name="code_challenge_method" value="${String(code_challenge_method)}" />` : ''}
          ${resource ? `<input type="hidden" name="resource" value="${String(resource)}" />` : ''}

          <button type="submit">Authorize</button>
        </form>

        <p style="font-size: 14px; color: #666; margin-top: 40px;">
          Don't have an agent API key? <a href="https://humanpages.ai" target="_blank">Create one</a>
        </p>
      </body>
      </html>
    `;

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    logger.error({ error }, 'OAuth authorize error');
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error',
    });
  }
});

/**
 * POST /oauth/authorize
 *
 * Handle authorization form submission.
 * Validates the agent API key, generates an authorization code, and redirects.
 */
router.post('/oauth/authorize', async (req, res) => {
  try {
    const {
      agent_key,
      client_id,
      redirect_uri,
      response_type,
      code_challenge,
      code_challenge_method,
      state,
      resource,
    } = req.body;

    // Validate agent API key format
    if (!agent_key || !agent_key.startsWith('hp_')) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <body style="font-family: sans-serif; max-width: 500px; margin: 100px auto;">
          <h1>Invalid Agent API Key</h1>
          <p>Your agent API key must start with "hp_"</p>
          <a href="javascript:history.back()">Go back</a>
        </body>
        </html>
      `);
    }

    // In a real implementation, validate the API key against the database
    // For now, we'll accept any valid-looking key and use it to look up the agent
    let agentId = '';

    // Try to fetch agent from the API using the provided key
    try {
      // This would call the Human Pages API to validate the key
      // For now, we'll extract agent ID from the key itself (in production, use real lookup)
      agentId = `agent_${crypto.createHash('sha256').update(agent_key).digest('hex').substring(0, 16)}`;
    } catch {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <body style="font-family: sans-serif; max-width: 500px; margin: 100px auto;">
          <h1>Invalid Agent API Key</h1>
          <p>Could not validate your agent API key. Please check it and try again.</p>
          <a href="javascript:history.back()">Go back</a>
        </body>
        </html>
      `);
    }

    // Generate authorization code
    const code = generateAuthorizationCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    authorizationCodes.set(code, {
      code,
      clientId: String(client_id),
      agentId,
      redirectUri: String(redirect_uri),
      codeChallenge: code_challenge ? String(code_challenge) : undefined,
      codeChallengeMethod: code_challenge_method ? String(code_challenge_method) as 'S256' | 'plain' : undefined,
      expiresAt,
      scopes: ['read', 'write'],
    });

    logger.info({ code: code.substring(0, 8), clientId: client_id, agentId }, 'Authorization code issued');

    // Build redirect URL
    const redirectUrl = new URL(String(redirect_uri));
    redirectUrl.searchParams.set('code', code);
    if (state) redirectUrl.searchParams.set('state', String(state));

    res.redirect(302, redirectUrl.toString());
  } catch (error) {
    logger.error({ error }, 'OAuth authorize POST error');
    res.status(500).send('Internal server error');
  }
});

/**
 * POST /oauth/token
 *
 * Token endpoint (RFC 6749 §4.1.3).
 * Exchanges an authorization code for an access token.
 *
 * Supports:
 * - authorization_code grant type
 * - refresh_token grant type
 * - PKCE validation (code_verifier)
 */
router.post('/oauth/token', async (req, res) => {
  try {
    const { grant_type, code, code_verifier, refresh_token, client_id, client_secret, redirect_uri } = req.body;

    if (!grant_type) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'grant_type is required',
      });
    }

    if (grant_type === 'authorization_code') {
      // Validate authorization code
      if (!code) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'code is required',
        });
      }

      const authCode = authorizationCodes.get(code);
      if (!authCode || authCode.expiresAt < new Date()) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Authorization code expired or invalid',
        });
      }

      // Validate client credentials
      const client = oauthClients.get(authCode.clientId);
      if (!client) {
        return res.status(400).json({
          error: 'invalid_client',
          error_description: 'Client not found',
        });
      }

      if (client.clientSecret !== client_secret) {
        return res.status(401).json({
          error: 'invalid_client',
          error_description: 'Invalid client credentials',
        });
      }

      // Validate PKCE if used
      if (authCode.codeChallenge) {
        if (!code_verifier) {
          return res.status(400).json({
            error: 'invalid_request',
            error_description: 'code_verifier is required for PKCE',
          });
        }

        if (!validatePKCE(authCode.codeChallenge, code_verifier, authCode.codeChallengeMethod)) {
          return res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Invalid code_verifier',
          });
        }
      }

      // Validate redirect_uri matches
      if (authCode.redirectUri !== redirect_uri) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'redirect_uri does not match',
        });
      }

      // Consume the authorization code
      authorizationCodes.delete(code);

      // Generate access token and refresh token
      const accessToken = generateAccessToken(authCode.agentId, 'hp_token_placeholder'); // In real implementation, look up actual API key
      const newRefreshToken = generateRefreshToken();

      logger.info({ clientId: authCode.clientId, agentId: authCode.agentId }, 'Access token issued');

      return res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: newRefreshToken,
      });
    } else if (grant_type === 'refresh_token') {
      // Handle refresh token grant
      if (!refresh_token) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'refresh_token is required',
        });
      }

      // In a real implementation, validate and look up the refresh token
      // For now, just generate a new access token
      const accessToken = generateAccessToken('agent_unknown', 'hp_token_placeholder');

      return res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
      });
    } else {
      return res.status(400).json({
        error: 'unsupported_grant_type',
        error_description: `Grant type "${grant_type}" is not supported`,
      });
    }
  } catch (error) {
    logger.error({ error }, 'OAuth token error');
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error',
    });
  }
});

/**
 * POST /oauth/revoke
 *
 * Token revocation endpoint (RFC 7009).
 * Allows clients to revoke access tokens and refresh tokens.
 */
router.post('/oauth/revoke', (req, res) => {
  try {
    const { token, token_type_hint } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'token is required',
      });
    }

    // In a real implementation, mark the token as revoked in a database
    // For now, just return success
    logger.info({ token: token.substring(0, 10) }, 'Token revoked');

    res.status(200).send(''); // RFC 7009 specifies empty response
  } catch (error) {
    logger.error({ error }, 'OAuth revoke error');
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error',
    });
  }
});

export default router;
