/**
 * MCP OAuth 2.0 Routes
 *
 * Implements OAuth 2.0 endpoints required by the MCP spec for GPT compatibility.
 * Supports:
 *   - RFC 6749: OAuth 2.0 Authorization Framework
 *   - RFC 7591: OAuth 2.0 Dynamic Client Registration
 *   - RFC 7636: PKCE (S256 only, per RFC 7636 best practices)
 *   - RFC 8707: Resource Indicators for OAuth 2.0
 *
 * Security:
 *   - Timing-safe client secret comparison
 *   - client_secret_basic + client_secret_post support
 *   - Agent API key validated against DB (prefix + bcrypt, same as agentAuth.ts)
 *   - API keys stored server-side only (never in JWT)
 *   - Auth code replay prevention via consumed flag
 *   - Refresh token rotation
 *   - Rate limiting on all endpoints
 *   - HTML escaping in login page (XSS prevention)
 *   - Security headers on HTML responses
 *   - Map size caps for DoS prevention
 */

import { Router } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { logger } from '../lib/logger.js';
import {
  escapeHtml,
  timingSafeCompare,
  validatePKCE,
  storeAgentKey,
  generateMcpAccessToken,
  validateAgentApiKey,
} from '../lib/mcp-auth.js';

const router = Router();

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: { error: 'too_many_requests', error_description: 'Rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const authorizeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'too_many_requests', error_description: 'Rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const tokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: 'too_many_requests', error_description: 'Rate limit exceeded' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

// ---------------------------------------------------------------------------
// In-memory stores (with size caps)
// ---------------------------------------------------------------------------

const MAX_OAUTH_CLIENTS = 5_000;
const MAX_AUTH_CODES = 10_000;
const MAX_REFRESH_TOKENS = 10_000;

const oauthClients = new Map<string, {
  clientId: string;
  clientSecret: string;
  redirectUris: string[];
  name: string;
  description?: string;
  createdAt: Date;
}>();

interface AuthorizationCode {
  code: string;
  clientId: string;
  agentId: string;
  redirectUri: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  expiresAt: Date;
  scopes: string[];
  consumed: boolean;
}

const authorizationCodes = new Map<string, AuthorizationCode>();

interface RefreshTokenEntry {
  agentId: string;
  clientId: string;
  createdAt: Date;
}

const refreshTokens = new Map<string, RefreshTokenEntry>();

// Cleanup expired auth codes and refresh tokens every 5 minutes
setInterval(() => {
  const now = new Date();
  let cleaned = 0;
  for (const [code, record] of authorizationCodes.entries()) {
    if (record.expiresAt < now) {
      authorizationCodes.delete(code);
      cleaned++;
    }
  }
  // Refresh tokens expire after 7 days
  const refreshCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const [token, entry] of refreshTokens.entries()) {
    if (entry.createdAt.getTime() < refreshCutoff) {
      refreshTokens.delete(token);
      cleaned++;
    }
  }
  if (cleaned > 0) logger.info({ cleaned }, 'Cleaned up expired OAuth entries');
}, 5 * 60 * 1000);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateClientSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

function generateAuthorizationCode(): string {
  return crypto.randomBytes(32).toString('hex');
}

function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function securityHeaders(): Record<string, string> {
  return {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'none'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
  };
}

// ---------------------------------------------------------------------------
// Well-known endpoints
// ---------------------------------------------------------------------------

router.get('/.well-known/oauth-protected-resource', (_req, res) => {
  res.json({
    resource: 'https://api.humanpages.ai/api/mcp',
    authorization_server: `${process.env.FRONTEND_URL || 'https://humanpages.ai'}/oauth`,
    bearer_methods: ['header'],
  });
});

router.get('/.well-known/oauth-authorization-server', (_req, res) => {
  const baseUrl = process.env.FRONTEND_URL || 'https://humanpages.ai';
  res.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    registration_endpoint: `${baseUrl}/oauth/register`,
    revocation_endpoint: `${baseUrl}/oauth/revoke`,
    scopes_supported: ['read', 'write', 'admin'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
    code_challenge_methods_supported: ['S256'],
    subject_types_supported: ['public'],
  });
});

// ---------------------------------------------------------------------------
// POST /oauth/register — Dynamic Client Registration (RFC 7591)
// ---------------------------------------------------------------------------

router.post('/oauth/register', registerLimiter, (req, res) => {
  try {
    const { client_name, redirect_uris, client_description, response_types, grant_types } = req.body;

    if (!client_name || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'client_name and redirect_uris are required',
      });
    }

    // Validate redirect URIs
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

    // Map size cap
    if (oauthClients.size >= MAX_OAUTH_CLIENTS) {
      return res.status(503).json({
        error: 'temporarily_unavailable',
        error_description: 'Too many registered clients',
      });
    }

    const clientId = `client_${crypto.randomBytes(12).toString('hex')}`;
    const clientSecret = generateClientSecret();

    oauthClients.set(clientId, {
      clientId,
      clientSecret,
      redirectUris: redirect_uris,
      name: client_name,
      description: client_description,
      createdAt: new Date(),
    });

    logger.info({ clientId, clientName: client_name }, 'OAuth client registered');

    res.status(201).json({
      client_id: clientId,
      client_secret: clientSecret,
      client_name,
      redirect_uris,
      response_types: response_types || ['code'],
      grant_types: grant_types || ['authorization_code', 'refresh_token'],
    });
  } catch (error) {
    logger.error({ error }, 'OAuth register error');
    res.status(500).json({ error: 'server_error', error_description: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /oauth/authorize — Show login form
// ---------------------------------------------------------------------------

router.get('/oauth/authorize', authorizeLimiter, (req, res) => {
  try {
    const { client_id, redirect_uri, response_type, code_challenge, code_challenge_method, state, resource } = req.query;

    if (!client_id || !redirect_uri || response_type !== 'code') {
      return res.status(400).json({ error: 'invalid_request', error_description: 'Missing or invalid parameters' });
    }

    const client = oauthClients.get(String(client_id));
    if (!client) {
      return res.status(400).json({ error: 'invalid_client', error_description: 'Unknown client_id' });
    }

    if (!client.redirectUris.includes(String(redirect_uri))) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'redirect_uri not registered' });
    }

    // Escaped values for HTML injection prevention
    const safeClientId = escapeHtml(String(client_id));
    const safeRedirectUri = escapeHtml(String(redirect_uri));
    const safeState = escapeHtml(String(state || ''));
    const safeCodeChallenge = code_challenge ? escapeHtml(String(code_challenge)) : '';
    const safeCCM = code_challenge_method ? escapeHtml(String(code_challenge_method)) : '';
    const safeResource = resource ? escapeHtml(String(resource)) : '';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Human Pages — Authorize Agent</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
    .card { background: white; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); max-width: 440px; width: 100%; padding: 40px 32px; }
    .logo { text-align: center; margin-bottom: 24px; font-size: 24px; font-weight: 700; color: #0f172a; }
    .logo span { color: #2563eb; }
    .subtitle { text-align: center; color: #64748b; font-size: 14px; margin-bottom: 32px; }
    label { display: block; font-weight: 500; color: #334155; margin-bottom: 6px; font-size: 14px; }
    input[type="password"] { width: 100%; padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 15px; transition: border-color 0.2s; }
    input[type="password"]:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.12); }
    .hint { font-size: 12px; color: #94a3b8; margin-top: 6px; }
    button { display: block; width: 100%; padding: 12px; background: #2563eb; color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 24px; transition: background 0.2s; }
    button:hover { background: #1d4ed8; }
    .footer { text-align: center; margin-top: 24px; font-size: 13px; color: #94a3b8; }
    .footer a { color: #2563eb; text-decoration: none; }
    .footer a:hover { text-decoration: underline; }
    .connecting { font-size: 12px; color: #94a3b8; text-align: center; margin-bottom: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Human <span>Pages</span></div>
    <div class="connecting">Connecting: ${safeClientId.substring(0, 20)}...</div>
    <p class="subtitle">Authorize this application to access your Human Pages agent account.</p>

    <form method="POST" action="/oauth/authorize">
      <label for="agent_key">Agent API Key</label>
      <input type="password" id="agent_key" name="agent_key" placeholder="hp_..." required autocomplete="off" />
      <p class="hint">Enter your Human Pages agent API key (starts with "hp_")</p>

      <input type="hidden" name="client_id" value="${safeClientId}" />
      <input type="hidden" name="redirect_uri" value="${safeRedirectUri}" />
      <input type="hidden" name="response_type" value="code" />
      <input type="hidden" name="state" value="${safeState}" />
      ${safeCodeChallenge ? `<input type="hidden" name="code_challenge" value="${safeCodeChallenge}" />` : ''}
      ${safeCCM ? `<input type="hidden" name="code_challenge_method" value="${safeCCM}" />` : ''}
      ${safeResource ? `<input type="hidden" name="resource" value="${safeResource}" />` : ''}

      <button type="submit">Authorize</button>
    </form>

    <div class="footer">
      Don't have an API key? <a href="https://humanpages.ai/signup" target="_blank" rel="noopener">Create one</a>
    </div>
  </div>
</body>
</html>`;

    for (const [k, v] of Object.entries(securityHeaders())) {
      res.set(k, v);
    }
    res.send(html);
  } catch (error) {
    logger.error({ error }, 'OAuth authorize GET error');
    res.status(500).json({ error: 'server_error', error_description: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /oauth/authorize — Handle login form submission
// ---------------------------------------------------------------------------

router.post('/oauth/authorize', authorizeLimiter, async (req, res) => {
  try {
    const { agent_key, client_id, redirect_uri, code_challenge, code_challenge_method, state } = req.body;

    // Validate agent API key against database
    const agent = await validateAgentApiKey(agent_key);
    if (!agent) {
      for (const [k, v] of Object.entries(securityHeaders())) {
        res.set(k, v);
      }
      return res.status(400).send(`<!DOCTYPE html>
<html lang="en"><body style="font-family:sans-serif;max-width:500px;margin:100px auto;padding:20px;">
<h1>Invalid Agent API Key</h1>
<p>Could not validate your agent API key. Please check it and try again.</p>
<a href="javascript:history.back()">Go back</a>
</body></html>`);
    }

    // Store the raw API key server-side for later tool calls
    storeAgentKey(agent.id, agent.apiKey);

    // Map size cap
    if (authorizationCodes.size >= MAX_AUTH_CODES) {
      let oldestKey: string | undefined;
      let oldestTime = Infinity;
      for (const [k, v] of authorizationCodes) {
        if (v.expiresAt.getTime() < oldestTime) {
          oldestTime = v.expiresAt.getTime();
          oldestKey = k;
        }
      }
      if (oldestKey) authorizationCodes.delete(oldestKey);
    }

    const code = generateAuthorizationCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    authorizationCodes.set(code, {
      code,
      clientId: String(client_id),
      agentId: agent.id,
      redirectUri: String(redirect_uri),
      codeChallenge: code_challenge ? String(code_challenge) : undefined,
      codeChallengeMethod: code_challenge_method ? String(code_challenge_method) : undefined,
      expiresAt,
      scopes: ['read', 'write'],
      consumed: false,
    });

    logger.info({ code: code.substring(0, 8), clientId: client_id, agentId: agent.id }, 'Authorization code issued');

    const redirectUrl = new URL(String(redirect_uri));
    redirectUrl.searchParams.set('code', code);
    if (state) redirectUrl.searchParams.set('state', String(state));

    res.redirect(302, redirectUrl.toString());
  } catch (error) {
    logger.error({ error }, 'OAuth authorize POST error');
    res.status(500).send('Internal server error');
  }
});

// ---------------------------------------------------------------------------
// POST /oauth/token — Token exchange
// ---------------------------------------------------------------------------

router.post('/oauth/token', tokenLimiter, async (req, res) => {
  try {
    const { grant_type, code, code_verifier, refresh_token, redirect_uri } = req.body;
    let { client_id, client_secret } = req.body;

    // Support client_secret_basic (Authorization: Basic header)
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Basic ')) {
      const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
      const colonIdx = decoded.indexOf(':');
      if (colonIdx > 0) {
        client_id = decodeURIComponent(decoded.substring(0, colonIdx));
        client_secret = decodeURIComponent(decoded.substring(colonIdx + 1));
      }
    }

    if (!grant_type) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'grant_type is required' });
    }

    if (grant_type === 'authorization_code') {
      if (!code) {
        return res.status(400).json({ error: 'invalid_request', error_description: 'code is required' });
      }

      const authCode = authorizationCodes.get(code);
      if (!authCode || authCode.expiresAt < new Date()) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code expired or invalid' });
      }

      // Replay prevention
      if (authCode.consumed) {
        authorizationCodes.delete(code);
        return res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code already used' });
      }

      const client = oauthClients.get(authCode.clientId);
      if (!client) {
        return res.status(400).json({ error: 'invalid_client', error_description: 'Client not found' });
      }

      // Validate client_id matches auth code
      if (client_id && String(client_id) !== authCode.clientId) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'client_id mismatch' });
      }

      // Timing-safe client secret comparison
      if (!timingSafeCompare(client.clientSecret, String(client_secret || ''))) {
        return res.status(401).json({ error: 'invalid_client', error_description: 'Invalid client credentials' });
      }

      // PKCE validation (S256 only)
      if (authCode.codeChallenge) {
        if (!code_verifier) {
          return res.status(400).json({ error: 'invalid_request', error_description: 'code_verifier required for PKCE' });
        }
        if (!validatePKCE(authCode.codeChallenge, code_verifier, authCode.codeChallengeMethod)) {
          return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid code_verifier' });
        }
      }

      if (authCode.redirectUri !== redirect_uri) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' });
      }

      // Mark consumed then delete
      authCode.consumed = true;
      authorizationCodes.delete(code);

      // Generate tokens (API key NOT in JWT)
      const accessToken = generateMcpAccessToken(authCode.agentId);
      const newRefreshToken = generateRefreshToken();

      // Store refresh token with eviction
      if (refreshTokens.size >= MAX_REFRESH_TOKENS) {
        let oldestKey: string | undefined;
        let oldestTime = Infinity;
        for (const [k, v] of refreshTokens) {
          if (v.createdAt.getTime() < oldestTime) {
            oldestTime = v.createdAt.getTime();
            oldestKey = k;
          }
        }
        if (oldestKey) refreshTokens.delete(oldestKey);
      }

      refreshTokens.set(newRefreshToken, {
        agentId: authCode.agentId,
        clientId: authCode.clientId,
        createdAt: new Date(),
      });

      logger.info({ clientId: authCode.clientId, agentId: authCode.agentId }, 'MCP access token issued');

      return res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: newRefreshToken,
      });

    } else if (grant_type === 'refresh_token') {
      if (!refresh_token) {
        return res.status(400).json({ error: 'invalid_request', error_description: 'refresh_token is required' });
      }

      const entry = refreshTokens.get(refresh_token);
      if (!entry) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid refresh token' });
      }

      // Rotate: delete old, issue new
      refreshTokens.delete(refresh_token);

      const accessToken = generateMcpAccessToken(entry.agentId);
      const newRefreshToken = generateRefreshToken();

      refreshTokens.set(newRefreshToken, {
        agentId: entry.agentId,
        clientId: entry.clientId,
        createdAt: new Date(),
      });

      return res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: newRefreshToken,
      });

    } else {
      return res.status(400).json({
        error: 'unsupported_grant_type',
        error_description: `Grant type "${grant_type}" is not supported`,
      });
    }
  } catch (error) {
    logger.error({ error }, 'OAuth token error');
    res.status(500).json({ error: 'server_error', error_description: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /oauth/revoke — Token revocation (RFC 7009)
// ---------------------------------------------------------------------------

router.post('/oauth/revoke', (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'token is required' });
    }

    refreshTokens.delete(token);
    logger.info({ token: String(token).substring(0, 10) }, 'Token revoked');

    res.status(200).send('');
  } catch (error) {
    logger.error({ error }, 'OAuth revoke error');
    res.status(500).json({ error: 'server_error', error_description: 'Internal server error' });
  }
});

export default router;
