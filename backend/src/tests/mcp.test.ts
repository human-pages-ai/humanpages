/**
 * MCP Integration Tests — Requires database and server
 *
 * Tests the complete flow ChatGPT follows when connecting:
 *   1. Discovery: .well-known endpoints
 *   2. CORS: chatgpt.com/chat.openai.com origins allowed
 *   3. OAuth: Dynamic Client Registration → Authorize
 *   4. MCP Protocol: initialize → tools/list → tools/call → DELETE
 *
 * Unit tests for minimizeResponse and tool definitions are in mcp-unit.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { cleanDatabase, createActiveTestAgent } from './helpers.js';
import { storeAgentKey, generateMcpAccessToken } from '../lib/mcp-auth.js';

// ---------------------------------------------------------------------------
// 1. Discovery endpoints
// ---------------------------------------------------------------------------

describe('MCP Discovery', () => {
  describe('GET /.well-known/oauth-protected-resource', () => {
    it('should return resource pointing to /api/mcp', async () => {
      const res = await request(app)
        .get('/.well-known/oauth-protected-resource');

      expect(res.status).toBe(200);
      expect(res.body.resource).toMatch(/\/mcp$/);
      expect(res.body.bearer_methods).toContain('header');
    });

    it('should be accessible without authentication', async () => {
      const res = await request(app)
        .get('/.well-known/oauth-protected-resource');

      expect(res.status).toBe(200);
    });
  });

  describe('GET /.well-known/oauth-authorization-server', () => {
    it('should return all required OAuth metadata', async () => {
      const res = await request(app)
        .get('/.well-known/oauth-authorization-server');

      expect(res.status).toBe(200);
      expect(res.body.issuer).toBeDefined();
      expect(res.body.authorization_endpoint).toMatch(/\/oauth\/authorize$/);
      expect(res.body.token_endpoint).toMatch(/\/oauth\/token$/);
      expect(res.body.registration_endpoint).toMatch(/\/oauth\/register$/);
      expect(res.body.revocation_endpoint).toMatch(/\/oauth\/revoke$/);
    });

    it('should advertise S256 code challenge method', async () => {
      const res = await request(app)
        .get('/.well-known/oauth-authorization-server');

      expect(res.body.code_challenge_methods_supported).toContain('S256');
    });

    it('should advertise client_secret_post (required by ChatGPT)', async () => {
      const res = await request(app)
        .get('/.well-known/oauth-authorization-server');

      expect(res.body.token_endpoint_auth_methods_supported).toContain('client_secret_post');
    });

    it('should advertise authorization_code grant type', async () => {
      const res = await request(app)
        .get('/.well-known/oauth-authorization-server');

      expect(res.body.grant_types_supported).toContain('authorization_code');
      expect(res.body.grant_types_supported).toContain('refresh_token');
    });

    it('should be accessible without authentication', async () => {
      const res = await request(app)
        .get('/.well-known/oauth-authorization-server');

      expect(res.status).toBe(200);
    });
  });
});

// ---------------------------------------------------------------------------
// 2. CORS
// ---------------------------------------------------------------------------

describe('MCP CORS', () => {
  it('should allow chatgpt.com origin on MCP endpoints', async () => {
    const res = await request(app)
      .options('/api/mcp')
      .set('Origin', 'https://chatgpt.com')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type,Authorization,MCP-Protocol-Version');

    expect(res.status).toBeLessThan(400);
    expect(res.headers['access-control-allow-origin']).toBe('https://chatgpt.com');
  });

  it('should allow chat.openai.com origin on MCP endpoints', async () => {
    const res = await request(app)
      .options('/api/mcp')
      .set('Origin', 'https://chat.openai.com')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type,Authorization');

    expect(res.status).toBeLessThan(400);
    expect(res.headers['access-control-allow-origin']).toBe('https://chat.openai.com');
  });

  it('should allow Mcp-Session-Id in request headers', async () => {
    const res = await request(app)
      .options('/api/mcp')
      .set('Origin', 'https://chatgpt.com')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Mcp-Session-Id');

    expect(res.status).toBeLessThan(400);
    const allowedHeaders = res.headers['access-control-allow-headers']?.toLowerCase();
    expect(allowedHeaders).toContain('mcp-session-id');
  });

  it('should expose Mcp-Session-Id in response headers', async () => {
    const res = await request(app)
      .options('/api/mcp')
      .set('Origin', 'https://chatgpt.com')
      .set('Access-Control-Request-Method', 'POST');

    const exposedHeaders = res.headers['access-control-expose-headers']?.toLowerCase();
    expect(exposedHeaders).toContain('mcp-session-id');
  });

  it('should allow chatgpt.com on .well-known endpoints', async () => {
    const res = await request(app)
      .get('/.well-known/oauth-protected-resource')
      .set('Origin', 'https://chatgpt.com');

    expect(res.headers['access-control-allow-origin']).toBe('https://chatgpt.com');
  });

  it('should reject unknown origins', async () => {
    const res = await request(app)
      .options('/api/mcp')
      .set('Origin', 'https://evil.com')
      .set('Access-Control-Request-Method', 'POST');

    // Either no CORS header or an error
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 3. OAuth flow
// ---------------------------------------------------------------------------

describe('MCP OAuth', () => {
  describe('POST /oauth/register (Dynamic Client Registration)', () => {
    it('should register a client and return client_id + client_secret', async () => {
      const res = await request(app)
        .post('/oauth/register')
        .send({
          client_name: 'ChatGPT Test Client',
          redirect_uris: ['https://chatgpt.com/oauth/callback'],
        });

      expect(res.status).toBe(201);
      expect(res.body.client_id).toBeDefined();
      expect(res.body.client_secret).toBeDefined();
      expect(res.body.client_name).toBe('ChatGPT Test Client');
      expect(res.body.redirect_uris).toContain('https://chatgpt.com/oauth/callback');
    });

    it('should reject registration without redirect_uris', async () => {
      const res = await request(app)
        .post('/oauth/register')
        .send({ client_name: 'Bad Client' });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('GET /oauth/authorize', () => {
    it('should return an HTML authorization form', async () => {
      // First register a client to get a valid client_id
      const regRes = await request(app)
        .post('/oauth/register')
        .send({
          client_name: 'Authorize Test Client',
          redirect_uris: ['https://chatgpt.com/oauth/callback'],
        });

      const res = await request(app)
        .get('/oauth/authorize')
        .query({
          response_type: 'code',
          client_id: regRes.body.client_id,
          redirect_uri: 'https://chatgpt.com/oauth/callback',
          code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
          code_challenge_method: 'S256',
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
    });
  });
});

// ---------------------------------------------------------------------------
// 4. MCP Protocol
// ---------------------------------------------------------------------------

describe('MCP Protocol', () => {
  let agentToken: string;
  let agent: { id: string; apiKey: string };

  beforeEach(async () => {
    await cleanDatabase();
    agent = await createActiveTestAgent();
    // Store API key in the server-side key store and generate a JWT
    storeAgentKey(agent.id, agent.apiKey);
    agentToken = generateMcpAccessToken(agent.id);
  });

  describe('POST /api/mcp — initialize', () => {
    it('should return protocol version 2025-06-18', async () => {
      const res = await request(app)
        .post('/api/mcp')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          jsonrpc: '2.0',
          method: 'initialize',
          id: 1,
        });

      expect(res.status).toBe(200);
      expect(res.body.result.protocolVersion).toBe('2025-06-18');
    });

    it('should declare tools capability', async () => {
      const res = await request(app)
        .post('/api/mcp')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          jsonrpc: '2.0',
          method: 'initialize',
          id: 1,
        });

      expect(res.body.result.capabilities.tools).toBeDefined();
    });

    it('should return a session ID header', async () => {
      const res = await request(app)
        .post('/api/mcp')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          jsonrpc: '2.0',
          method: 'initialize',
          id: 1,
        });

      expect(res.headers['mcp-session-id']).toMatch(/^session_/);
    });

    it('should return server info', async () => {
      const res = await request(app)
        .post('/api/mcp')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          jsonrpc: '2.0',
          method: 'initialize',
          id: 1,
        });

      expect(res.body.result.serverInfo.name).toBe('Human Pages MCP Server');
      expect(res.body.result.serverInfo.version).toBeDefined();
    });
  });

  describe('POST /api/mcp — tools/list', () => {
    it('should return all 9 tools', async () => {
      const res = await request(app)
        .post('/api/mcp')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 2,
        });

      expect(res.status).toBe(200);
      expect(res.body.result.tools).toHaveLength(9);
    });

    it('should include annotations on every tool', async () => {
      const res = await request(app)
        .post('/api/mcp')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 2,
        });

      for (const tool of res.body.result.tools) {
        expect(tool.annotations).toBeDefined();
        expect(typeof tool.annotations.readOnlyHint).toBe('boolean');
        expect(typeof tool.annotations.destructiveHint).toBe('boolean');
        expect(typeof tool.annotations.openWorldHint).toBe('boolean');
      }
    });

    it('should mark read-only tools correctly', async () => {
      const res = await request(app)
        .post('/api/mcp')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 2,
        });

      const readOnlyNames = ['search_humans', 'get_human', 'get_human_profile', 'get_agent', 'browse_listings', 'ping'];
      const writeNames = ['register_agent', 'create_job', 'create_listing'];

      for (const tool of res.body.result.tools) {
        if (readOnlyNames.includes(tool.name)) {
          expect(tool.annotations.readOnlyHint).toBe(true);
          expect(tool.annotations.destructiveHint).toBe(false);
        }
        if (writeNames.includes(tool.name)) {
          expect(tool.annotations.readOnlyHint).toBe(false);
        }
      }
    });

    it('should include inputSchema on every tool', async () => {
      const res = await request(app)
        .post('/api/mcp')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          jsonrpc: '2.0',
          method: 'tools/list',
          id: 2,
        });

      for (const tool of res.body.result.tools) {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
      }
    });
  });

  describe('POST /api/mcp — notifications/initialized', () => {
    it('should return 204 for initialized notification', async () => {
      const res = await request(app)
        .post('/api/mcp')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          jsonrpc: '2.0',
          method: 'notifications/initialized',
        });

      expect(res.status).toBe(204);
    });
  });

  describe('POST /api/mcp — tools/call ping', () => {
    it('should execute ping tool and return ok status', async () => {
      const res = await request(app)
        .post('/api/mcp')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'ping', arguments: {} },
          id: 5,
        });

      expect(res.status).toBe(200);
      expect(res.body.result.content).toBeDefined();
      expect(res.body.result.content[0].type).toBe('text');
      const parsed = JSON.parse(res.body.result.content[0].text);
      expect(parsed.status).toBe('ok');
    });
  });

  describe('POST /api/mcp — error handling', () => {
    it('should reject requests without auth', async () => {
      const res = await request(app)
        .post('/api/mcp')
        .send({
          jsonrpc: '2.0',
          method: 'initialize',
          id: 1,
        });

      expect(res.status).toBe(401);
    });

    it('should reject invalid JSON-RPC', async () => {
      const res = await request(app)
        .post('/api/mcp')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ version: '1.0', method: 'initialize' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(-32600);
    });

    it('should reject unknown methods', async () => {
      const res = await request(app)
        .post('/api/mcp')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          jsonrpc: '2.0',
          method: 'nonexistent/method',
          id: 3,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(-32601);
    });

    it('should reject unknown tool names', async () => {
      const res = await request(app)
        .post('/api/mcp')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'nonexistent_tool', arguments: {} },
          id: 4,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toBe('Unknown tool');
    });

    it('should reject requests with invalid bearer token', async () => {
      const res = await request(app)
        .post('/api/mcp')
        .set('Authorization', 'Bearer invalid-jwt-token')
        .send({
          jsonrpc: '2.0',
          method: 'initialize',
          id: 1,
        });

      expect(res.status).toBe(401);
    });
  });

  describe('Session management', () => {
    it('should reuse session when Mcp-Session-Id header is sent', async () => {
      // Create session
      const initRes = await request(app)
        .post('/api/mcp')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ jsonrpc: '2.0', method: 'initialize', id: 1 });

      const sessionId = initRes.headers['mcp-session-id'];

      // Reuse session
      const listRes = await request(app)
        .post('/api/mcp')
        .set('Authorization', `Bearer ${agentToken}`)
        .set('Mcp-Session-Id', sessionId)
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 2 });

      expect(listRes.status).toBe(200);
      expect(listRes.headers['mcp-session-id']).toBe(sessionId);
    });
  });

  describe('DELETE /api/mcp — session termination', () => {
    it('should terminate a valid session', async () => {
      const initRes = await request(app)
        .post('/api/mcp')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ jsonrpc: '2.0', method: 'initialize', id: 1 });

      const sessionId = initRes.headers['mcp-session-id'];
      expect(sessionId).toBeDefined();

      const delRes = await request(app)
        .delete('/api/mcp')
        .set('Authorization', `Bearer ${agentToken}`)
        .set('Mcp-Session-Id', sessionId);

      expect(delRes.status).toBe(204);
    });

    it('should return 400 without session ID', async () => {
      const res = await request(app)
        .delete('/api/mcp');

      expect(res.status).toBe(400);
    });

    it('should return 404 for unknown session', async () => {
      const res = await request(app)
        .delete('/api/mcp')
        .set('Mcp-Session-Id', 'session_nonexistent');

      expect(res.status).toBe(404);
    });

    it('should prevent reuse of terminated session', async () => {
      const initRes = await request(app)
        .post('/api/mcp')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({ jsonrpc: '2.0', method: 'initialize', id: 1 });

      const sessionId = initRes.headers['mcp-session-id'];

      // Delete session
      await request(app)
        .delete('/api/mcp')
        .set('Authorization', `Bearer ${agentToken}`)
        .set('Mcp-Session-Id', sessionId);

      // Try to reuse — should create new session or fail
      const reuseRes = await request(app)
        .post('/api/mcp')
        .set('Authorization', `Bearer ${agentToken}`)
        .set('Mcp-Session-Id', sessionId)
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 2 });

      // Session was deleted, so with auth token it creates a new one
      // The new session ID should differ from the deleted one
      expect(reuseRes.status).toBe(200);
      expect(reuseRes.headers['mcp-session-id']).not.toBe(sessionId);
    });
  });
});
