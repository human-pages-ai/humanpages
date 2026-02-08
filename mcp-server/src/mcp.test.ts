import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { resolve } from 'path';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';

// Helper: send JSON-RPC messages to the MCP server and collect responses
function createMcpClient() {
  let proc: ChildProcess;
  let buffer = '';
  const responses: Map<number, any> = new Map();
  const waiters: Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }> = new Map();

  return {
    start() {
      proc = spawn('node', [resolve(__dirname, '../dist/index.js')], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, API_BASE_URL: API_BASE },
      });

      proc.stdout!.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop()!;
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.id !== undefined) {
              responses.set(msg.id, msg);
              const waiter = waiters.get(msg.id);
              if (waiter) {
                waiters.delete(msg.id);
                waiter.resolve(msg);
              }
            }
          } catch {
            // ignore non-JSON lines
          }
        }
      });
    },

    send(msg: any): Promise<any> {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          waiters.delete(msg.id);
          reject(new Error(`Timeout waiting for response to id=${msg.id}`));
        }, 25000);

        waiters.set(msg.id, {
          resolve: (v) => { clearTimeout(timeout); resolve(v); },
          reject: (e) => { clearTimeout(timeout); reject(e); },
        });

        proc.stdin!.write(JSON.stringify(msg) + '\n');
      });
    },

    stop() {
      proc?.kill();
    },
  };
}

describe('MCP Server', () => {
  const client = createMcpClient();
  let nextId = 1;

  function id() { return nextId++; }

  beforeAll(async () => {
    // Verify backend API is reachable
    try {
      const res = await fetch(`${API_BASE}/api/humans/search`);
      if (!res.ok) throw new Error(`API returned ${res.status}`);
    } catch (e) {
      throw new Error(`Backend API not reachable at ${API_BASE}. Start the backend first.`);
    }

    client.start();
  });

  afterAll(() => {
    client.stop();
  });

  describe('initialize', () => {
    it('should complete MCP handshake', async () => {
      const res = await client.send({
        jsonrpc: '2.0',
        id: id(),
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-suite', version: '1.0' },
        },
      });

      expect(res.result).toBeDefined();
      expect(res.result.serverInfo.name).toBe('humanpages');
      expect(res.result.serverInfo.version).toBe('1.0.0');
      expect(res.result.capabilities.tools).toBeDefined();
    });
  });

  describe('tools/list', () => {
    it('should list all 6 tools', async () => {
      const res = await client.send({
        jsonrpc: '2.0',
        id: id(),
        method: 'tools/list',
        params: {},
      });

      const tools = res.result.tools;
      expect(tools).toHaveLength(6);

      const names = tools.map((t: any) => t.name);
      expect(names).toContain('search_humans');
      expect(names).toContain('get_human');
      expect(names).toContain('create_job_offer');
      expect(names).toContain('get_job_status');
      expect(names).toContain('mark_job_paid');
      expect(names).toContain('leave_review');
    });

    it('should have input schemas for all tools', async () => {
      const res = await client.send({
        jsonrpc: '2.0',
        id: id(),
        method: 'tools/list',
        params: {},
      });

      for (const tool of res.result.tools) {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.description).toBeTruthy();
      }
    });
  });

  describe('search_humans', () => {
    it('should return results with no filters', async () => {
      const res = await client.send({
        jsonrpc: '2.0',
        id: id(),
        method: 'tools/call',
        params: { name: 'search_humans', arguments: {} },
      });

      expect(res.result.content).toHaveLength(1);
      expect(res.result.content[0].type).toBe('text');
      expect(res.result.content[0].text).toContain('Found');
      expect(res.result.content[0].text).toContain('human(s)');
    });

    it('should filter by location', async () => {
      const res = await client.send({
        jsonrpc: '2.0',
        id: id(),
        method: 'tools/call',
        params: { name: 'search_humans', arguments: { location: 'Bangkok' } },
      });

      const text = res.result.content[0].text;
      expect(text).toContain('Found 1 human(s)');
      expect(text).toContain('Bangkok');
    });

    it('should return no results for non-existent skill', async () => {
      const res = await client.send({
        jsonrpc: '2.0',
        id: id(),
        method: 'tools/call',
        params: { name: 'search_humans', arguments: { skill: 'underwater-basket-weaving' } },
      });

      expect(res.result.content[0].text).toContain('No humans found');
    });

    it('should include contact info and wallet in results', async () => {
      const res = await client.send({
        jsonrpc: '2.0',
        id: id(),
        method: 'tools/call',
        params: { name: 'search_humans', arguments: { location: 'San Francisco' } },
      });

      const text = res.result.content[0].text;
      expect(text).toContain('Alice Smith');
      expect(text).toContain('Contact:');
      expect(text).toContain('Wallet:');
      expect(text).toContain('Skills:');
    });
  });

  describe('get_human', () => {
    let humanId: string;

    beforeAll(async () => {
      // Get a human ID from search
      const res = await fetch(`${API_BASE}/api/humans/search`);
      const humans = await res.json() as any[];
      humanId = humans[0].id;
    });

    it('should return full profile', async () => {
      const res = await client.send({
        jsonrpc: '2.0',
        id: id(),
        method: 'tools/call',
        params: { name: 'get_human', arguments: { id: humanId } },
      });

      const text = res.result.content[0].text;
      expect(text).toContain('## Bio');
      expect(text).toContain('## Location');
      expect(text).toContain('## Capabilities');
      expect(text).toContain('## Contact');
      expect(text).toContain('## Payment Wallets');
      expect(text).toContain('## Services Offered');
    });

    it('should error for non-existent human', async () => {
      const res = await client.send({
        jsonrpc: '2.0',
        id: id(),
        method: 'tools/call',
        params: { name: 'get_human', arguments: { id: 'nonexistent-id-999' } },
      });

      expect(res.result.isError).toBe(true);
      expect(res.result.content[0].text).toContain('Error');
    });
  });

  describe('create_job_offer', () => {
    let humanId: string;

    beforeAll(async () => {
      const res = await fetch(`${API_BASE}/api/humans/search`);
      const humans = await res.json() as any[];
      humanId = humans[0].id;
    });

    it('should create a job offer and return job ID', async () => {
      const res = await client.send({
        jsonrpc: '2.0',
        id: id(),
        method: 'tools/call',
        params: {
          name: 'create_job_offer',
          arguments: {
            human_id: humanId,
            title: 'Test Job from MCP Tests',
            description: 'Automated test job offer',
            price_usdc: 50,
            agent_id: 'mcp-test-suite',
            agent_name: 'MCP Test',
          },
        },
      });

      const text = res.result.content[0].text;
      expect(text).toContain('Job Offer Created');
      expect(text).toContain('Job ID:');
      expect(text).toContain('PENDING');
      expect(text).toContain('Next Step');
    });

    it('should error for non-existent human', async () => {
      const res = await client.send({
        jsonrpc: '2.0',
        id: id(),
        method: 'tools/call',
        params: {
          name: 'create_job_offer',
          arguments: {
            human_id: 'nonexistent-id',
            title: 'Bad Job',
            description: 'This should fail',
            price_usdc: 50,
            agent_id: 'mcp-test-suite',
          },
        },
      });

      expect(res.result.isError).toBe(true);
      expect(res.result.content[0].text).toContain('Error');
    });
  });

  describe('get_job_status', () => {
    let jobId: string;

    beforeAll(async () => {
      // Create a job via REST to get a known job ID
      const humans = await (await fetch(`${API_BASE}/api/humans/search`)).json() as any[];
      const res = await fetch(`${API_BASE}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          humanId: humans[0].id,
          title: 'Status Test Job',
          description: 'Testing get_job_status',
          priceUsdc: 25,
          agentId: 'mcp-test-status',
        }),
      });
      const job = await res.json() as any;
      jobId = job.id;
    });

    it('should return job status', async () => {
      const res = await client.send({
        jsonrpc: '2.0',
        id: id(),
        method: 'tools/call',
        params: { name: 'get_job_status', arguments: { job_id: jobId } },
      });

      const text = res.result.content[0].text;
      expect(text).toContain('Job Status');
      expect(text).toContain(jobId);
      expect(text).toContain('PENDING');
      expect(text).toContain('Next Step');
    });

    it('should error for non-existent job', async () => {
      const res = await client.send({
        jsonrpc: '2.0',
        id: id(),
        method: 'tools/call',
        params: { name: 'get_job_status', arguments: { job_id: 'nonexistent-job-id' } },
      });

      expect(res.result.isError).toBe(true);
      expect(res.result.content[0].text).toContain('Error');
    });
  });

  describe('mark_job_paid', () => {
    it('should error for non-accepted job', async () => {
      // Create a new job (PENDING status)
      const humans = await (await fetch(`${API_BASE}/api/humans/search`)).json() as any[];
      const jobRes = await fetch(`${API_BASE}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          humanId: humans[0].id,
          title: 'Payment Test Job',
          description: 'Testing mark_job_paid on non-accepted job',
          priceUsdc: 10,
          agentId: 'mcp-test-pay',
        }),
      });
      const job = await jobRes.json() as any;

      const res = await client.send({
        jsonrpc: '2.0',
        id: id(),
        method: 'tools/call',
        params: {
          name: 'mark_job_paid',
          arguments: {
            job_id: job.id,
            payment_tx_hash: '0xfake123',
            payment_network: 'ethereum',
            payment_amount: 10,
          },
        },
      });

      expect(res.result.isError).toBe(true);
      expect(res.result.content[0].text).toContain('Error');
    });
  });

  describe('leave_review', () => {
    it('should error for non-completed job', async () => {
      const humans = await (await fetch(`${API_BASE}/api/humans/search`)).json() as any[];
      const jobRes = await fetch(`${API_BASE}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          humanId: humans[0].id,
          title: 'Review Test Job',
          description: 'Testing leave_review on non-completed job',
          priceUsdc: 10,
          agentId: 'mcp-test-review',
        }),
      });
      const job = await jobRes.json() as any;

      const res = await client.send({
        jsonrpc: '2.0',
        id: id(),
        method: 'tools/call',
        params: {
          name: 'leave_review',
          arguments: { job_id: job.id, rating: 5, comment: 'Great!' },
        },
      });

      expect(res.result.isError).toBe(true);
      expect(res.result.content[0].text).toContain('Error');
    });
  });

  describe('unknown tool', () => {
    it('should return error for unknown tool name', async () => {
      const res = await client.send({
        jsonrpc: '2.0',
        id: id(),
        method: 'tools/call',
        params: { name: 'nonexistent_tool', arguments: {} },
      });

      expect(res.result.isError).toBe(true);
      expect(res.result.content[0].text).toContain('Unknown tool');
    });
  });
});
