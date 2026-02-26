import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test initLogShipping behavior without actually creating pino transports,
// so we mock pino and @axiomhq/pino at the module level.

const mockPino = vi.fn(() => ({
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  level: 'info',
}));

vi.mock('pino', () => ({
  default: mockPino,
}));

vi.mock('@axiomhq/pino', () => ({}));

describe('logger', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    mockPino.mockClear();
    // Clean Axiom env vars
    delete process.env.AXIOM_DATASET;
    delete process.env.AXIOM_TOKEN;
    delete process.env.LOG_LEVEL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('exports a logger instance', async () => {
    const mod = await import('../lib/logger.js');
    expect(mod.logger).toBeDefined();
    expect(typeof mod.logger.info).toBe('function');
  });

  it('exports initLogShipping function', async () => {
    const mod = await import('../lib/logger.js');
    expect(typeof mod.initLogShipping).toBe('function');
  });

  it('initLogShipping is a no-op when AXIOM env vars are missing', async () => {
    const mod = await import('../lib/logger.js');
    const initialCallCount = mockPino.mock.calls.length;

    mod.initLogShipping();

    // pino should NOT have been called again (no new logger created)
    expect(mockPino.mock.calls.length).toBe(initialCallCount);
  });

  it('initLogShipping creates new logger when AXIOM env vars are set', async () => {
    process.env.AXIOM_DATASET = 'test-dataset';
    process.env.AXIOM_TOKEN = 'test-token-123';

    const mod = await import('../lib/logger.js');
    const initialCallCount = mockPino.mock.calls.length;

    mod.initLogShipping();

    // pino should have been called again to create a new logger with Axiom transport
    expect(mockPino.mock.calls.length).toBe(initialCallCount + 1);

    // The new call should include Axiom transport target
    const lastCall = mockPino.mock.calls[mockPino.mock.calls.length - 1];
    const config = lastCall[0];
    expect(config.transport.targets).toHaveLength(2);
    expect(config.transport.targets[1].target).toBe('@axiomhq/pino');
    expect(config.transport.targets[1].options.dataset).toBe('test-dataset');
    expect(config.transport.targets[1].options.token).toBe('test-token-123');
  });

  it('initLogShipping respects LOG_LEVEL env var', async () => {
    process.env.AXIOM_DATASET = 'test-dataset';
    process.env.AXIOM_TOKEN = 'test-token-123';
    process.env.LOG_LEVEL = 'warn';

    const mod = await import('../lib/logger.js');
    mod.initLogShipping();

    const lastCall = mockPino.mock.calls[mockPino.mock.calls.length - 1];
    expect(lastCall[0].level).toBe('warn');
  });

  it('initLogShipping always includes stdout transport', async () => {
    process.env.AXIOM_DATASET = 'test-dataset';
    process.env.AXIOM_TOKEN = 'test-token-123';

    const mod = await import('../lib/logger.js');
    mod.initLogShipping();

    const lastCall = mockPino.mock.calls[mockPino.mock.calls.length - 1];
    const targets = lastCall[0].transport.targets;
    expect(targets[0].target).toBe('pino/file');
    expect(targets[0].options.destination).toBe(1);
  });

  it('initial logger has redaction configured', async () => {
    const mod = await import('../lib/logger.js');
    // First call to pino (module init)
    const firstCall = mockPino.mock.calls[0];
    expect(firstCall[0].redact).toContain('authorization');
    expect(firstCall[0].redact).toContain('password');
    expect(firstCall[0].redact).toContain('token');
    expect(firstCall[0].redact).toContain('req.headers.authorization');
  });

  it('initLogShipping preserves redaction on new logger', async () => {
    process.env.AXIOM_DATASET = 'test-dataset';
    process.env.AXIOM_TOKEN = 'test-token-123';

    const mod = await import('../lib/logger.js');
    mod.initLogShipping();

    const lastCall = mockPino.mock.calls[mockPino.mock.calls.length - 1];
    expect(lastCall[0].redact).toContain('authorization');
    expect(lastCall[0].redact).toContain('password');
    expect(lastCall[0].redact).toContain('callbackSecret');
  });

  it('initLogShipping only adds AXIOM_TOKEN not missing partial config', async () => {
    // Only dataset set, no token
    process.env.AXIOM_DATASET = 'test-dataset';

    const mod = await import('../lib/logger.js');
    const initialCallCount = mockPino.mock.calls.length;

    mod.initLogShipping();

    // Should be a no-op — don't create Axiom transport with partial config
    expect(mockPino.mock.calls.length).toBe(initialCallCount);
  });
});

describe('secrets - AXIOM keys', () => {
  it('SECRETS_TO_FETCH includes AXIOM_DATASET and AXIOM_TOKEN', async () => {
    // We can't easily import secrets.ts without mocking Infisical,
    // but we can at least verify the file content contains the keys
    const { readFileSync } = await import('fs');
    const { join, dirname } = await import('path');
    const { fileURLToPath } = await import('url');

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const secretsContent = readFileSync(join(__dirname, '..', 'lib', 'secrets.ts'), 'utf-8');

    expect(secretsContent).toContain("'AXIOM_DATASET'");
    expect(secretsContent).toContain("'AXIOM_TOKEN'");
  });

  it('secrets.ts calls initLogShipping in both code paths', async () => {
    const { readFileSync } = await import('fs');
    const { join, dirname } = await import('path');
    const { fileURLToPath } = await import('url');

    const __dirname = dirname(fileURLToPath(import.meta.url));
    const secretsContent = readFileSync(join(__dirname, '..', 'lib', 'secrets.ts'), 'utf-8');

    // Should call initLogShipping() at least twice (Infisical path + .env fallback path)
    const matches = secretsContent.match(/initLogShipping\(\)/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(2);
  });
});
