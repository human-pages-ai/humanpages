/**
 * MCP Unit Tests — No database or server required
 *
 * Tests pure functions and static definitions:
 *   1. Response minimization (minimizeResponse)
 *   2. Tool definitions (MCP_TOOLS registry)
 *
 * Run standalone: npx vitest run src/tests/mcp-unit.test.ts --config vitest.unit.config.ts
 * Run with all tests: npx vitest run (uses default config, requires DB)
 */

import { describe, it, expect } from 'vitest';
import { minimizeResponse, MCP_TOOLS } from '../lib/mcp-tools.js';

// ---------------------------------------------------------------------------
// 1. Response minimization (unit tests)
// ---------------------------------------------------------------------------

describe('minimizeResponse', () => {
  it('should strip timestamp fields', () => {
    const input = { name: 'Alice', timestamp: '2025-01-01T00:00:00Z', skill: 'React' };
    const output = minimizeResponse(input);
    expect(output).toEqual({ name: 'Alice', skill: 'React' });
  });

  it('should strip request/trace IDs', () => {
    const input = { data: 'ok', requestId: 'abc', traceId: 'xyz', correlationId: '123' };
    const output = minimizeResponse(input);
    expect(output).toEqual({ data: 'ok' });
  });

  it('should strip session and debug info', () => {
    const input = { result: true, sessionId: 's1', debugInfo: {}, stackTrace: 'line1' };
    const output = minimizeResponse(input);
    expect(output).toEqual({ result: true });
  });

  it('should strip snake_case variants', () => {
    const input = { ok: true, request_id: 'r1', trace_id: 't1', session_id: 's1', debug_info: {} };
    const output = minimizeResponse(input);
    expect(output).toEqual({ ok: true });
  });

  it('should strip fields recursively in nested objects', () => {
    const input = {
      user: { name: 'Bob', internalId: 'x' },
      meta: { timestamp: 'now', data: { duration: 100, score: 5 } },
    };
    const output = minimizeResponse(input);
    expect(output).toEqual({
      user: { name: 'Bob' },
      meta: { data: { score: 5 } },
    });
  });

  it('should strip fields inside arrays', () => {
    const input = [
      { name: 'A', timestamp: '1' },
      { name: 'B', requestId: '2' },
    ];
    const output = minimizeResponse(input);
    expect(output).toEqual([{ name: 'A' }, { name: 'B' }]);
  });

  it('should preserve null, undefined, and primitives', () => {
    expect(minimizeResponse(null)).toBe(null);
    expect(minimizeResponse(undefined)).toBe(undefined);
    expect(minimizeResponse(42)).toBe(42);
    expect(minimizeResponse('hello')).toBe('hello');
    expect(minimizeResponse(true)).toBe(true);
  });

  it('should preserve empty objects and arrays', () => {
    expect(minimizeResponse({})).toEqual({});
    expect(minimizeResponse([])).toEqual([]);
  });

  it('should handle deeply nested stripping', () => {
    const input = {
      level1: {
        level2: {
          level3: {
            value: 'keep',
            trace_id: 'strip',
            stack_trace: 'strip',
          },
        },
        duration_ms: 42,
      },
    };
    const output = minimizeResponse(input);
    expect(output).toEqual({
      level1: {
        level2: {
          level3: { value: 'keep' },
        },
      },
    });
  });

  it('should handle mixed arrays with primitives and objects', () => {
    const input = [1, 'two', { name: 'three', timestamp: 'strip' }, null];
    const output = minimizeResponse(input);
    expect(output).toEqual([1, 'two', { name: 'three' }, null]);
  });

  it('should strip all known metadata field variants', () => {
    const allStripped: Record<string, unknown> = {
      timestamp: 'x', requestId: 'x', request_id: 'x',
      traceId: 'x', trace_id: 'x', correlationId: 'x', correlation_id: 'x',
      duration: 'x', durationMs: 'x', duration_ms: 'x', latency: 'x',
      serverVersion: 'x', server_version: 'x', apiVersion: 'x', api_version: 'x',
      sessionId: 'x', session_id: 'x', internalId: 'x', internal_id: 'x',
      debugInfo: 'x', debug_info: 'x', stackTrace: 'x', stack_trace: 'x',
    };
    const input = { ...allStripped, keep: 'this' };
    const output = minimizeResponse(input);
    expect(output).toEqual({ keep: 'this' });
  });
});

// ---------------------------------------------------------------------------
// 2. Tool definitions (static checks)
// ---------------------------------------------------------------------------

describe('MCP Tool Definitions', () => {
  const allTools = Object.values(MCP_TOOLS);
  const toolNames = Object.keys(MCP_TOOLS);

  it('should define exactly 9 tools', () => {
    expect(allTools).toHaveLength(9);
  });

  it('should have matching name keys and name properties', () => {
    for (const [key, tool] of Object.entries(MCP_TOOLS)) {
      expect(tool.name).toBe(key);
    }
  });

  it('every tool should have name, description, inputSchema, annotations', () => {
    for (const tool of allTools) {
      expect(tool.name).toBeTruthy();
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.inputSchema).toBeDefined();
      expect(tool.annotations).toBeDefined();
    }
  });

  it('every tool description should be clear and specific', () => {
    for (const tool of allTools) {
      expect(tool.description.length).toBeGreaterThan(40);
      expect(tool.description).not.toContain('TODO');
      expect(tool.description).not.toContain('FIXME');
    }
  });

  it('every tool inputSchema should have type "object"', () => {
    for (const tool of allTools) {
      expect(tool.inputSchema.type).toBe('object');
    }
  });

  it('every annotation should have all four boolean hints', () => {
    for (const tool of allTools) {
      const a = tool.annotations!;
      expect(typeof a.readOnlyHint).toBe('boolean');
      expect(typeof a.destructiveHint).toBe('boolean');
      expect(typeof a.idempotentHint).toBe('boolean');
      expect(typeof a.openWorldHint).toBe('boolean');
    }
  });

  it('ping tool should have no required fields', () => {
    const ping = MCP_TOOLS['ping'];
    expect(ping.inputSchema.required).toBeUndefined();
    expect(ping.annotations?.readOnlyHint).toBe(true);
  });

  it('read-only tools should be marked correctly', () => {
    const readOnlyNames = ['search_humans', 'get_human', 'get_human_profile', 'get_agent', 'browse_listings', 'ping'];
    for (const name of readOnlyNames) {
      const tool = MCP_TOOLS[name];
      expect(tool.annotations?.readOnlyHint).toBe(true);
      expect(tool.annotations?.destructiveHint).toBe(false);
    }
  });

  it('write tools should not be marked readOnly', () => {
    const writeTools = ['register_agent', 'create_job', 'create_listing'];
    for (const name of writeTools) {
      const tool = MCP_TOOLS[name];
      expect(tool.annotations?.readOnlyHint).toBe(false);
    }
  });

  it('all tools that query external API should have openWorldHint', () => {
    for (const tool of allTools) {
      if (tool.name === 'ping') {
        expect(tool.annotations?.openWorldHint).toBe(false);
      } else {
        expect(tool.annotations?.openWorldHint).toBe(true);
      }
    }
  });

  it('register_agent should not request PII (no email, no website_url)', () => {
    const schema = MCP_TOOLS['register_agent'].inputSchema as any;
    const props = Object.keys(schema.properties || {});
    expect(props).not.toContain('contact_email');
    expect(props).not.toContain('website_url');
    expect(props).not.toContain('email');
  });

  it('tools with required params should list them', () => {
    const toolsWithRequired = ['get_human', 'get_human_profile', 'get_agent', 'create_job', 'create_listing', 'register_agent'];
    for (const name of toolsWithRequired) {
      const schema = MCP_TOOLS[name].inputSchema as any;
      expect(Array.isArray(schema.required)).toBe(true);
      expect(schema.required.length).toBeGreaterThan(0);
    }
  });

  it('no tool should have destructiveHint=true (no delete operations)', () => {
    for (const tool of allTools) {
      expect(tool.annotations?.destructiveHint).toBe(false);
    }
  });
});
