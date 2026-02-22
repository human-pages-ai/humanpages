import OpenAI from 'openai';
import { logger } from './logger.js';

/**
 * Parses OPENAI_API_KEY env var which may contain multiple comma-separated keys.
 * Returns a non-empty array of trimmed, non-empty keys.
 */
function parseKeys(): string[] {
  const raw = process.env.OPENAI_API_KEY ?? '';
  return raw
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

/** Round-robin counter (not persisted — resets on restart, which is fine). */
let rrIndex = 0;

/**
 * Pick the next API key using round-robin.
 * Throws if no keys are configured.
 */
export function getOpenAIKey(): string {
  const keys = parseKeys();
  if (keys.length === 0) {
    throw new Error('OPENAI_API_KEY not configured');
  }
  const key = keys[rrIndex % keys.length];
  rrIndex = (rrIndex + 1) % keys.length;
  return key;
}

/**
 * Returns true when at least one OpenAI API key is configured.
 */
export function hasOpenAIKey(): boolean {
  return parseKeys().length > 0;
}

/**
 * Create a fresh OpenAI client using the next key in the rotation.
 * Each call may return a client with a different key.
 */
export function createOpenAIClient(opts?: { maxRetries?: number; timeout?: number }): OpenAI {
  const apiKey = getOpenAIKey();
  const client = new OpenAI({
    apiKey,
    maxRetries: opts?.maxRetries ?? 3,
    timeout: opts?.timeout ?? 30_000,
  });
  logger.debug({ keyPrefix: apiKey.slice(0, 8) + '...' }, 'Created OpenAI client');
  return client;
}
