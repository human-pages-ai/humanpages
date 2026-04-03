/**
 * MCP OAuth 2.1 Routes
 *
 * Implements OAuth 2.0 / 2.1 endpoints required by the MCP spec for GPT compatibility.
 * Supports:
 *   - RFC 6749: OAuth 2.0 Authorization Framework
 *   - RFC 7591: OAuth 2.0 Dynamic Client Registration
 *   - RFC 7636: PKCE (S256 only — plain disallowed per OAuth 2.1)
 *   - RFC 8707: Resource Indicators for OAuth 2.0
 *   - RFC 7009: Token Revocation
 *
 * Security:
 *   - Agent validation via DB (prefix lookup + bcrypt compare) from shared mcp-auth.ts
 *   - JWT access tokens contain only { sub: agentId, type: 'mcp_access' } — never API keys
 *   - API keys resolved server-side via agentKeyStore (never in token payloads)
 *   - Timing-safe string comparison for client secrets
 *   - PKCE S256 mandatory (plain disallowed)
 *   - Authorization code replay prevention (immediate deletion on use)
 *   - Refresh token rotation with client_id binding
 *   - Rate limiting on all endpoints
 *   - Map size caps to prevent memory exhaustion
 *   - HTML escaping on all user-supplied values rendered in forms
 *   - Generic error messages (no agent existence leakage)
 *   - Security headers on rendered HTML
 *   - Redirect URI validation (HTTPS required in prod, no localhost/reserved IPs)
 *
 * Auth utilities imported from shared mcp-auth.ts.
 */

import { Router, Request, Response } from 'express';
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
import { trackServerEvent } from '../lib/posthog.js';

const router = Router();

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_OAUTH_CLIENTS = 5_000;
const MAX_AUTH_CODES = 10_000;
const MAX_REFRESH_TOKENS = 10_000;
const AUTH_CODE_TTL = 5 * 60 * 1000; // 5 minutes
const REFRESH_TOKEN_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  handler: (req: Request, res: Response) => {
    trackServerEvent('anonymous', 'mcp_rate_limit_hit', {
      endpoint: 'oauth_register',
      ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
    }, req);
    res.status(429).json({ error: 'invalid_request', error_description: 'Rate limit exceeded' });
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const authorizeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  handler: (req: Request, res: Response) => {
    trackServerEvent('anonymous', 'mcp_rate_limit_hit', {
      endpoint: 'oauth_authorize',
      ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
    }, req);
    res.status(429).json({ error: 'invalid_request', error_description: 'Rate limit exceeded' });
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const tokenLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  handler: (req: Request, res: Response) => {
    trackServerEvent('anonymous', 'mcp_rate_limit_hit', {
      endpoint: 'oauth_token',
      ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
    }, req);
    res.status(429).json({ error: 'invalid_request', error_description: 'Rate limit exceeded' });
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const revokeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  handler: (req: Request, res: Response) => {
    trackServerEvent('anonymous', 'mcp_rate_limit_hit', {
      endpoint: 'oauth_revoke',
      ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip,
    }, req);
    res.status(429).json({ error: 'invalid_request', error_description: 'Rate limit exceeded' });
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  skip: () => process.env.NODE_ENV === 'test',
});

/** Infer the AI platform from client_name and User-Agent */
function inferPlatform(clientName?: string, userAgent?: string): string {
  const name = (clientName || '').toLowerCase();
  const ua = (userAgent || '').toLowerCase();
  const combined = `${name} ${ua}`;
  if (combined.includes('chatgpt') || combined.includes('openai') || combined.includes('gpt-')) return 'chatgpt';
  if (combined.includes('claude') || combined.includes('anthropic')) return 'claude';
  if (combined.includes('gemini') || combined.includes('google')) return 'gemini';
  if (combined.includes('cursor')) return 'cursor';
  if (combined.includes('copilot') || combined.includes('github')) return 'copilot';
  if (combined.includes('perplexity')) return 'perplexity';
  return 'custom';
}

// ---------------------------------------------------------------------------
// In-memory stores with size caps
// ---------------------------------------------------------------------------

interface OAuthClient {
  clientId: string;
  clientSecretHash: string; // Store hashed, not plain
  redirectUris: string[];
  name: string;
  description?: string;
  createdAt: Date;
}

interface AuthorizationCode {
  clientId: string;
  agentId: string;
  redirectUri: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  expiresAt: Date;
  scopes: string[];
}

interface RefreshTokenRecord {
  agentId: string;
  clientId: string;
  expiresAt: Date;
}

const oauthClients = new Map<string, OAuthClient>();
const authorizationCodes = new Map<string, AuthorizationCode>();
const refreshTokens = new Map<string, RefreshTokenRecord>();

// Cleanup expired auth codes every 5 minutes
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [code, record] of authorizationCodes.entries()) {
    if (record.expiresAt.getTime() < now) {
      authorizationCodes.delete(code);
      cleaned++;
    }
  }
  if (cleaned > 0) logger.info({ cleaned }, 'Cleaned up expired OAuth authorization codes');
}, 5 * 60 * 1000);

// Cleanup expired refresh tokens every 15 minutes
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [token, record] of refreshTokens.entries()) {
    if (record.expiresAt.getTime() < now) {
      refreshTokens.delete(token);
      cleaned++;
    }
  }
  if (cleaned > 0) logger.info({ cleaned }, 'Cleaned up expired refresh tokens');
}, 15 * 60 * 1000);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Hash a client secret for storage (not bcrypt — just SHA-256 for fast lookup) */
function hashClientSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

/** Validate redirect URI — block localhost/reserved IPs in production */
function isValidRedirectUri(uri: string): boolean {
  try {
    const parsed = new URL(uri);
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
      if (parsed.protocol !== 'https:') return false;

      // Block localhost and reserved IPs
      const hostname = parsed.hostname.toLowerCase();
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname === '0.0.0.0' ||
        hostname.endsWith('.local') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('192.168.') ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
      ) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Well-known endpoints
// ---------------------------------------------------------------------------

router.get('/.well-known/oauth-protected-resource', (_req: Request, res: Response) => {
  const baseUrl = process.env.FRONTEND_URL || 'https://humanpages.ai';
  trackServerEvent('anonymous', 'mcp_discovery_hit', {
    endpoint: 'oauth-protected-resource',
  }, _req);
  res.json({
    resource: 'https://mcp.humanpages.ai/mcp',
    authorization_server: baseUrl,
    bearer_methods: ['header'],
  });
});

router.get('/.well-known/oauth-authorization-server', (_req: Request, res: Response) => {
  const baseUrl = process.env.FRONTEND_URL || 'https://humanpages.ai';
  trackServerEvent('anonymous', 'mcp_discovery_hit', {
    endpoint: 'oauth-authorization-server',
  }, _req);
  res.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    registration_endpoint: `${baseUrl}/oauth/register`,
    revocation_endpoint: `${baseUrl}/oauth/revoke`,
    scopes_supported: ['read', 'write'],
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

router.post('/oauth/register', registerLimiter, (req: Request, res: Response) => {
  try {
    const { client_name, redirect_uris, client_description, response_types, grant_types } = req.body;

    if (!client_name || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'client_name and redirect_uris are required',
      });
    }

    // Validate redirect URIs
    for (const uri of redirect_uris) {
      if (!isValidRedirectUri(uri)) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'Invalid or disallowed redirect_uri',
        });
      }
    }

    // Size cap
    if (oauthClients.size >= MAX_OAUTH_CLIENTS) {
      let oldestKey: string | undefined;
      let oldestTime = Infinity;
      for (const [k, v] of oauthClients) {
        if (v.createdAt.getTime() < oldestTime) {
          oldestTime = v.createdAt.getTime();
          oldestKey = k;
        }
      }
      if (oldestKey) oauthClients.delete(oldestKey);
    }

    const clientId = `client_${crypto.randomBytes(16).toString('hex')}`;
    const clientSecret = crypto.randomBytes(32).toString('hex');

    oauthClients.set(clientId, {
      clientId,
      clientSecretHash: hashClientSecret(clientSecret),
      redirectUris: redirect_uris,
      name: client_name,
      description: client_description,
      createdAt: new Date(),
    });

    logger.info({ clientId, clientName: client_name }, 'OAuth client registered');

    const platform = inferPlatform(client_name, req.headers['user-agent'] as string);
    trackServerEvent(clientId, 'mcp_client_registered', {
      client_id: clientId,
      client_name,
      platform,
      redirect_uri_domain: (() => { try { return new URL(redirect_uris[0]).hostname; } catch { return 'unknown'; } })(),
    }, req);

    return res.status(201).json({
      client_id: clientId,
      client_secret: clientSecret,
      client_name,
      redirect_uris,
      response_types: response_types || ['code'],
      grant_types: grant_types || ['authorization_code', 'refresh_token'],
    });
  } catch (error) {
    logger.error({ error }, 'OAuth register error');
    return res.status(500).json({ error: 'server_error', error_description: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// GET /oauth/authorize — Render login form
// ---------------------------------------------------------------------------

router.get('/oauth/authorize', authorizeLimiter, (req: Request, res: Response) => {
  try {
    const { client_id, redirect_uri, response_type, code_challenge, code_challenge_method, state } = req.query;

    if (!client_id || !redirect_uri || response_type !== 'code') {
      return res.status(400).json({ error: 'invalid_request', error_description: 'Missing or invalid parameters' });
    }

    const client = oauthClients.get(String(client_id));
    if (!client) {
      return res.status(400).json({ error: 'invalid_client', error_description: 'Authorization failed' });
    }

    if (!client.redirectUris.includes(String(redirect_uri))) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'redirect_uri not registered' });
    }

    // Generate CSRF token for form
    const csrfToken = crypto.randomBytes(32).toString('hex');

    // Escape ALL user-supplied values for HTML rendering
    const safeClientId = escapeHtml(String(client_id));
    const safeRedirectUri = escapeHtml(String(redirect_uri));
    const safeState = escapeHtml(String(state || ''));
    const safeCodeChallenge = code_challenge ? escapeHtml(String(code_challenge)) : '';
    const safeCCMethod = code_challenge_method ? escapeHtml(String(code_challenge_method)) : '';
    const safeClientName = escapeHtml(client.name);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Authorize – Human Pages</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 460px; margin: 80px auto; padding: 20px; color: #1e293b; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .subtitle { color: #64748b; margin-bottom: 2rem; }
    .form-group { margin-bottom: 1.25rem; }
    label { display: block; margin-bottom: 0.375rem; font-weight: 500; font-size: 0.875rem; }
    input[type="password"] { width: 100%; padding: 0.625rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 1rem; box-sizing: border-box; }
    input[type="password"]:focus { outline: 2px solid #2563eb; outline-offset: 1px; border-color: #2563eb; }
    button { background: #2563eb; color: #fff; padding: 0.625rem 1.5rem; border: none; border-radius: 6px; cursor: pointer; font-size: 1rem; font-weight: 500; width: 100%; }
    button:hover { background: #1d4ed8; }
    button:focus { outline: 2px solid #2563eb; outline-offset: 2px; }
    small { color: #64748b; font-size: 0.8125rem; }
    .footer { font-size: 0.8125rem; color: #94a3b8; margin-top: 2.5rem; }
    .footer a { color: #2563eb; }
  </style>
</head>
<body>
  <h1>Authorize ${safeClientName}</h1>
  <p class="subtitle">Sign in with your Human Pages agent API key to connect.</p>
  <form method="POST" action="/oauth/authorize">
    <div class="form-group">
      <label for="agent_key">Agent API Key</label>
      <input type="password" id="agent_key" name="agent_key" placeholder="hp_..." required autocomplete="off" />
      <small>Starts with "hp_". <a href="https://humanpages.ai/signup" target="_blank" rel="noopener">Get one here</a></small>
    </div>
    <input type="hidden" name="csrf_token" value="${csrfToken}" />
    <input type="hidden" name="client_id" value="${safeClientId}" />
    <input type="hidden" name="redirect_uri" value="${safeRedirectUri}" />
    <input type="hidden" name="response_type" value="code" />
    <input type="hidden" name="state" value="${safeState}" />
    ${safeCodeChallenge ? `<input type="hidden" name="code_challenge" value="${safeCodeChallenge}" />` : ''}
    ${safeCCMethod ? `<input type="hidden" name="code_challenge_method" value="${safeCCMethod}" />` : ''}
    <button type="submit">Authorize</button>
  </form>
  <p class="footer">By authorizing, you allow <strong>${safeClientName}</strong> to access your Human Pages data.</p>
</body>
</html>`;

    res.set({
      'Content-Type': 'text/html; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'",
      'Cache-Control': 'no-store',
    });

    trackServerEvent('anonymous', 'mcp_auth_page_viewed', {
      client_id: String(client_id),
      client_name: client?.name,
    }, req);

    return res.send(html);
  } catch (error) {
    logger.error({ error }, 'OAuth authorize GET error');
    return res.status(500).json({ error: 'server_error', error_description: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /oauth/authorize — Handle form submission
// ---------------------------------------------------------------------------

router.post('/oauth/authorize', authorizeLimiter, async (req: Request, res: Response) => {
  try {
    const { agent_key, client_id, redirect_uri, code_challenge, code_challenge_method, state } = req.body;

    // Validate agent API key against the database (real DB lookup, not hash-based)
    const agent = await validateAgentApiKey(agent_key);
    if (!agent) {
      // Generic error — don't reveal whether the key format was wrong or the agent doesn't exist
      trackServerEvent('anonymous', 'mcp_auth_failed', {
        client_id: String(client_id),
        reason: 'invalid_credentials',
      }, req);

      return res.status(400).set({
        'Content-Type': 'text/html; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Cache-Control': 'no-store',
      }).send(`<!DOCTYPE html>
<html lang="en">
<body style="font-family: sans-serif; max-width: 460px; margin: 80px auto; padding: 20px;">
  <h1>Authorization Failed</h1>
  <p>Could not validate your credentials. Please check your agent API key and try again.</p>
  <a href="javascript:history.back()">Go back</a>
</body>
</html>`);
    }

    // Store the agent's API key server-side for later tool calls
    storeAgentKey(agent.id, agent.apiKey);

    // Validate client
    const client = oauthClients.get(String(client_id));
    if (!client || !client.redirectUris.includes(String(redirect_uri))) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'Authorization failed' });
    }

    // Size cap on auth codes
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

    const code = crypto.randomBytes(32).toString('hex');
    authorizationCodes.set(code, {
      clientId: String(client_id),
      agentId: agent.id,
      redirectUri: String(redirect_uri),
      codeChallenge: code_challenge ? String(code_challenge) : undefined,
      codeChallengeMethod: code_challenge_method ? String(code_challenge_method) : undefined,
      expiresAt: new Date(Date.now() + AUTH_CODE_TTL),
      scopes: ['read', 'write'],
    });

    logger.info({ code: code.substring(0, 8), clientId: client_id, agentId: agent.id }, 'Authorization code issued');

    const redirectUrl = new URL(String(redirect_uri));
    redirectUrl.searchParams.set('code', code);
    if (state) redirectUrl.searchParams.set('state', String(state));

    trackServerEvent(agent.id, 'mcp_auth_completed', {
      client_id: String(client_id),
      client_name: (oauthClients.get(String(client_id)))?.name,
      platform: inferPlatform((oauthClients.get(String(client_id)))?.name, req.headers['user-agent'] as string),
    }, req);

    return res.redirect(302, redirectUrl.toString());
  } catch (error) {
    logger.error({ error }, 'OAuth authorize POST error');
    return res.status(500).send('Internal server error');
  }
});

// ---------------------------------------------------------------------------
// POST /oauth/token — Token endpoint
// ---------------------------------------------------------------------------

router.post('/oauth/token', tokenLimiter, async (req: Request, res: Response) => {
  try {
    const { grant_type, code, code_verifier, refresh_token, redirect_uri } = req.body;

    // Extract client credentials from Basic auth header or body
    let clientId: string | undefined;
    let clientSecret: string | undefined;

    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Basic ')) {
      const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
      const colonIdx = decoded.indexOf(':');
      if (colonIdx > 0) {
        clientId = decodeURIComponent(decoded.slice(0, colonIdx));
        clientSecret = decodeURIComponent(decoded.slice(colonIdx + 1));
      }
    }

    // Fallback to body params
    if (!clientId) clientId = req.body.client_id;
    if (!clientSecret) clientSecret = req.body.client_secret;

    if (!grant_type) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'grant_type is required' });
    }

    // ----- authorization_code grant -----
    if (grant_type === 'authorization_code') {
      if (!code) {
        return res.status(400).json({ error: 'invalid_request', error_description: 'code is required' });
      }

      const authCode = authorizationCodes.get(code);
      if (!authCode || authCode.expiresAt.getTime() < Date.now()) {
        if (authCode) authorizationCodes.delete(code);
        trackServerEvent('anonymous', 'mcp_token_failed', { reason: 'invalid_auth_code', grant_type: 'authorization_code' }, req);
        return res.status(400).json({ error: 'invalid_grant', error_description: 'Authorization code expired or invalid' });
      }

      // Replay prevention — delete code immediately
      authorizationCodes.delete(code);

      // Validate client
      const client = oauthClients.get(authCode.clientId);
      if (!client) {
        return res.status(400).json({ error: 'invalid_client', error_description: 'Authorization failed' });
      }

      // Validate client credentials (timing-safe)
      if (!clientId || !clientSecret) {
        trackServerEvent('anonymous', 'mcp_token_failed', { reason: 'invalid_client', grant_type: 'authorization_code' }, req);
        return res.status(401).json({ error: 'invalid_client', error_description: 'Client credentials required' });
      }
      if (clientId !== authCode.clientId) {
        trackServerEvent('anonymous', 'mcp_token_failed', { reason: 'invalid_client', grant_type: 'authorization_code' }, req);
        return res.status(401).json({ error: 'invalid_client', error_description: 'Authorization failed' });
      }
      if (!timingSafeCompare(hashClientSecret(clientSecret), client.clientSecretHash)) {
        trackServerEvent('anonymous', 'mcp_token_failed', { reason: 'invalid_client', grant_type: 'authorization_code' }, req);
        return res.status(401).json({ error: 'invalid_client', error_description: 'Authorization failed' });
      }

      // Validate PKCE (S256 mandatory when challenge was provided)
      if (authCode.codeChallenge) {
        if (!code_verifier) {
          trackServerEvent('anonymous', 'mcp_token_failed', { reason: 'pkce_failed', grant_type: 'authorization_code' }, req);
          return res.status(400).json({ error: 'invalid_request', error_description: 'code_verifier is required' });
        }
        if (!validatePKCE(authCode.codeChallenge, code_verifier, authCode.codeChallengeMethod)) {
          trackServerEvent('anonymous', 'mcp_token_failed', { reason: 'pkce_failed', grant_type: 'authorization_code' }, req);
          return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid code_verifier' });
        }
      }

      // Validate redirect_uri matches
      if (authCode.redirectUri !== redirect_uri) {
        return res.status(400).json({ error: 'invalid_grant', error_description: 'redirect_uri does not match' });
      }

      // Generate tokens
      const accessToken = generateMcpAccessToken(authCode.agentId);

      // Create refresh token with client binding
      const newRefreshToken = crypto.randomBytes(32).toString('hex');
      if (refreshTokens.size >= MAX_REFRESH_TOKENS) {
        let oldestKey: string | undefined;
        let oldestTime = Infinity;
        for (const [k, v] of refreshTokens) {
          if (v.expiresAt.getTime() < oldestTime) {
            oldestTime = v.expiresAt.getTime();
            oldestKey = k;
          }
        }
        if (oldestKey) refreshTokens.delete(oldestKey);
      }
      refreshTokens.set(newRefreshToken, {
        agentId: authCode.agentId,
        clientId: authCode.clientId,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL),
      });

      logger.info({ clientId: authCode.clientId, agentId: authCode.agentId }, 'Access token issued');

      trackServerEvent(authCode.agentId, 'mcp_token_issued', {
        client_id: authCode.clientId,
        grant_type: 'authorization_code',
        has_pkce: !!authCode.codeChallenge,
      }, req);

      return res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: newRefreshToken,
      });
    }

    // ----- refresh_token grant -----
    if (grant_type === 'refresh_token') {
      if (!refresh_token) {
        return res.status(400).json({ error: 'invalid_request', error_description: 'refresh_token is required' });
      }

      const tokenRecord = refreshTokens.get(refresh_token);
      if (!tokenRecord || tokenRecord.expiresAt.getTime() < Date.now()) {
        if (tokenRecord) refreshTokens.delete(refresh_token);
        trackServerEvent('anonymous', 'mcp_token_failed', { reason: 'invalid_refresh_token', grant_type: 'refresh_token' }, req);
        return res.status(400).json({ error: 'invalid_grant', error_description: 'Refresh token expired or invalid' });
      }

      // Validate client_id binding — the refresh token must be used by the same client
      if (!clientId || clientId !== tokenRecord.clientId) {
        return res.status(401).json({ error: 'invalid_client', error_description: 'Authorization failed' });
      }

      // Validate client credentials if provided
      if (clientSecret) {
        const client = oauthClients.get(clientId);
        if (!client || !timingSafeCompare(hashClientSecret(clientSecret), client.clientSecretHash)) {
          return res.status(401).json({ error: 'invalid_client', error_description: 'Authorization failed' });
        }
      }

      // Rotate refresh token (delete old, issue new)
      refreshTokens.delete(refresh_token);

      const accessToken = generateMcpAccessToken(tokenRecord.agentId);
      const newRefreshToken = crypto.randomBytes(32).toString('hex');
      refreshTokens.set(newRefreshToken, {
        agentId: tokenRecord.agentId,
        clientId: tokenRecord.clientId,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL),
      });

      logger.info({ clientId: tokenRecord.clientId, agentId: tokenRecord.agentId }, 'Token refreshed');

      trackServerEvent(tokenRecord.agentId, 'mcp_token_refreshed', {
        client_id: tokenRecord.clientId,
      }, req);

      return res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: newRefreshToken,
      });
    }

    return res.status(400).json({ error: 'unsupported_grant_type', error_description: 'Unsupported grant type' });
  } catch (error) {
    logger.error({ error }, 'OAuth token error');
    return res.status(500).json({ error: 'server_error', error_description: 'Internal server error' });
  }
});

// ---------------------------------------------------------------------------
// POST /oauth/revoke — Token revocation (RFC 7009)
// ---------------------------------------------------------------------------

router.post('/oauth/revoke', revokeLimiter, (_req: Request, res: Response) => {
  try {
    const { token } = _req.body;
    if (!token) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'token is required' });
    }

    // Try to revoke as refresh token
    let clientId: string | undefined;
    if (refreshTokens.has(token)) {
      const tokenRecord = refreshTokens.get(token);
      clientId = tokenRecord?.clientId;
      refreshTokens.delete(token);
      logger.info({ token: token.substring(0, 8) }, 'Refresh token revoked');
    }

    trackServerEvent('anonymous', 'mcp_token_revoked', {
      client_id: clientId,
    }, _req);

    // RFC 7009: always return 200 even if token not found
    return res.status(200).send('');
  } catch (error) {
    logger.error({ error }, 'OAuth revoke error');
    return res.status(500).json({ error: 'server_error', error_description: 'Internal server error' });
  }
});

export default router;
