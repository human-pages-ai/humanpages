/**
 * MCP Auth — Shared authentication utilities for MCP endpoints.
 *
 * Provides:
 *   - Agent validation via DB (prefix lookup + bcrypt compare) — same pattern as agentAuth.ts
 *   - JWT access token generation (sub-only, no API key in payload)
 *   - Server-side agent key store (in-memory with TTL)
 *   - JWT verification (proper jwt.verify, not jwt.decode)
 *   - Timing-safe string comparison
 *   - PKCE validation (S256 only, per RFC 7636)
 *   - HTML escaping for rendered pages
 *
 * Used by:
 *   - mcp-oauth.ts (OAuth 2.0 endpoints)
 *   - mcp-remote.ts (Streamable HTTP transport)
 */

import crypto, { createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';
import { logger } from './logger.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AGENT_KEY_TTL = 30 * 60 * 1000; // 30 minutes
const MAX_AGENT_KEYS = 5_000;

// ---------------------------------------------------------------------------
// HTML escaping (for OAuth login page)
// ---------------------------------------------------------------------------

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// ---------------------------------------------------------------------------
// Timing-safe compare
// ---------------------------------------------------------------------------

export function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// ---------------------------------------------------------------------------
// PKCE validation — S256 only, per RFC 7636
// ---------------------------------------------------------------------------

export function validatePKCE(
  codeChallenge: string,
  codeVerifier: string,
  method?: string,
): boolean {
  // Only S256 allowed
  if (method !== 'S256') return false;
  // RFC 7636 §4.1: code_verifier is 43-128 unreserved characters
  if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(codeVerifier)) return false;
  // S256 challenge is a 43-char base64url hash
  if (codeChallenge.length !== 43) return false;

  const hash = createHash('sha256').update(codeVerifier).digest('base64url');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(codeChallenge));
}

// ---------------------------------------------------------------------------
// Agent key store — maps agentId → { apiKey, expiresAt }
// Server-side only; never exposed in JWT payloads.
// ---------------------------------------------------------------------------

interface StoredAgentKey {
  apiKey: string;
  expiresAt: number;
}

const agentKeyStore = new Map<string, StoredAgentKey>();

/** Store an agent's API key for later tool-call resolution. */
export function storeAgentKey(agentId: string, apiKey: string): void {
  // Evict oldest if at capacity
  if (agentKeyStore.size >= MAX_AGENT_KEYS) {
    let oldestKey: string | undefined;
    let oldestTime = Infinity;
    for (const [k, v] of agentKeyStore) {
      if (v.expiresAt < oldestTime) {
        oldestTime = v.expiresAt;
        oldestKey = k;
      }
    }
    if (oldestKey) agentKeyStore.delete(oldestKey);
  }
  agentKeyStore.set(agentId, {
    apiKey,
    expiresAt: Date.now() + AGENT_KEY_TTL,
  });
}

/** Retrieve stored API key for an agent. Returns null if expired or missing. */
export function getAgentApiKey(agentId: string): string | null {
  const entry = agentKeyStore.get(agentId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    agentKeyStore.delete(agentId);
    return null;
  }
  return entry.apiKey;
}

// Periodic cleanup of expired keys (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [k, v] of agentKeyStore) {
    if (now > v.expiresAt) {
      agentKeyStore.delete(k);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.info({ cleaned }, 'Cleaned up expired agent key store entries');
  }
}, 5 * 60 * 1000);

// ---------------------------------------------------------------------------
// Agent validation — same pattern as agentAuth.ts
// Looks up agent by key prefix → bcrypt compare → returns agent info.
// ---------------------------------------------------------------------------

export interface ValidatedAgent {
  id: string;
  name: string;
  status: string;
}

/**
 * Validate a raw agent API key against the database.
 * @returns agent info + the raw key (for storage), or null if invalid.
 */
export async function validateAgentApiKey(
  apiKey: string,
): Promise<(ValidatedAgent & { apiKey: string }) | null> {
  if (!apiKey || !apiKey.startsWith('hp_')) return null;

  const prefix = apiKey.substring(0, 8);
  try {
    const agent = await prisma.agent.findUnique({
      where: { apiKeyPrefix: prefix },
      select: { id: true, name: true, apiKeyHash: true, status: true },
    });
    if (!agent) return null;

    const valid = await bcrypt.compare(apiKey, agent.apiKeyHash);
    if (!valid) return null;

    // Update lastActiveAt in the background
    prisma.agent.update({
      where: { id: agent.id },
      data: { lastActiveAt: new Date() },
    }).catch((err) => logger.error({ err, agentId: agent.id }, 'Failed to update agent lastActiveAt'));

    return {
      id: agent.id,
      name: agent.name,
      status: agent.status,
      apiKey,
    };
  } catch (err) {
    logger.error({ err }, 'MCP agent validation error');
    return null;
  }
}

// ---------------------------------------------------------------------------
// JWT token generation (sub-only, no API key in payload)
// ---------------------------------------------------------------------------

export function generateMcpAccessToken(agentId: string): string {
  return jwt.sign(
    { sub: agentId, type: 'mcp_access' },
    process.env.JWT_SECRET!,
    { algorithm: 'HS256', expiresIn: '1h' },
  );
}

// ---------------------------------------------------------------------------
// JWT verification — proper jwt.verify(), not jwt.decode()
// ---------------------------------------------------------------------------

export function verifyMcpAccessToken(token: string): { agentId: string } | null {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as Record<string, unknown>;
    if (payload.type !== 'mcp_access' || typeof payload.sub !== 'string') return null;
    return { agentId: payload.sub };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Bearer token extraction
// ---------------------------------------------------------------------------

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}
