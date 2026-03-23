/**
 * Private LLM proxy service for the Moltbook solver.
 * Runs as a separate process on the server, NOT published or open-sourced.
 *
 * Receives { systemPrompt, userPrompt, model } and returns { text, inputTokens, outputTokens }.
 * The backend solver calls this via SOLVER_LLM_URL.
 *
 * Usage:
 *   SOLVER_LLM_PORT=3457 npx tsx services/solver-llm/index.ts
 *
 * Backend .env:
 *   SOLVER_LLM_BACKEND=internal
 *   SOLVER_LLM_URL=http://localhost:3457/llm
 */

import http from 'node:http';
import Anthropic from '@anthropic-ai/sdk';

const PORT = parseInt(process.env.SOLVER_LLM_PORT ?? '3457', 10);

const client = new Anthropic();

async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  model: string,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const response = await client.messages.create({
    model,
    max_tokens: 256,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const block = response.content[0];
  if (block.type !== 'text') throw new Error('Non-text response from Anthropic');

  return {
    text: block.text,
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };
}

const server = http.createServer(async (req, res) => {
  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // Only accept POST /llm
  if (req.method !== 'POST' || req.url !== '/llm') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  // Only accept requests from localhost
  const remote = req.socket.remoteAddress;
  if (remote !== '127.0.0.1' && remote !== '::1' && remote !== '::ffff:127.0.0.1') {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Forbidden — localhost only' }));
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = JSON.parse(Buffer.concat(chunks).toString());

    const { systemPrompt, userPrompt, model } = body;
    if (!systemPrompt || !userPrompt) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'systemPrompt and userPrompt required' }));
      return;
    }

    const result = await callLLM(systemPrompt, userPrompt, model ?? 'claude-haiku-4-5');

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  } catch (err) {
    console.error('[solver-llm] Error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'LLM call failed' }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[solver-llm] Listening on 127.0.0.1:${PORT}`);
});
