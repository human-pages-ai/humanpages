/**
 * Pluggable LLM backend for the Moltbook solver.
 *
 * Configure via SOLVER_LLM_BACKEND env var:
 *   - "anthropic" (default): Uses Anthropic API with ANTHROPIC_API_KEY
 *   - "openai": Uses OpenAI-compatible API with OPENAI_API_KEY and optional OPENAI_BASE_URL
 *   - "internal": Proxies to a self-hosted LLM service at SOLVER_LLM_URL
 *
 * Model overrides via SOLVER_MODEL_PRIMARY and SOLVER_MODEL_TIEBREAKER env vars.
 */

type LLMBackend = 'anthropic' | 'openai' | 'internal';

export interface LLMResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

function getBackend(): LLMBackend {
  const backend = process.env.SOLVER_LLM_BACKEND ?? 'anthropic';
  if (!['anthropic', 'openai', 'internal'].includes(backend)) {
    throw new Error(`Unknown SOLVER_LLM_BACKEND: ${backend}. Use "anthropic", "openai", or "internal".`);
  }
  return backend as LLMBackend;
}

// ─── Anthropic backend ───────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let anthropicClient: any = null;

async function askAnthropic(systemPrompt: string, userPrompt: string, model: string): Promise<LLMResult> {
  if (!anthropicClient) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');
    anthropicClient = new Anthropic({ apiKey });
  }

  const response = await anthropicClient.messages.create({
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

// ─── OpenAI-compatible backend ───────────────────────────────────

async function askOpenAI(systemPrompt: string, userPrompt: string, model: string): Promise<LLMResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');
  const baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1';

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 256,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${body}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
    usage?: { prompt_tokens: number; completion_tokens: number };
  };
  return {
    text: data.choices[0]?.message?.content ?? '',
    inputTokens: data.usage?.prompt_tokens ?? 0,
    outputTokens: data.usage?.completion_tokens ?? 0,
  };
}

// ─── Internal LLM service backend ───────────────────────────────

async function askInternal(systemPrompt: string, userPrompt: string, model: string): Promise<LLMResult> {
  const url = process.env.SOLVER_LLM_URL;
  if (!url) throw new Error('SOLVER_LLM_URL not configured (required for "internal" backend)');

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ systemPrompt, userPrompt, model }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Internal LLM service error (${response.status}): ${body}`);
  }

  const data = await response.json() as { text: string; inputTokens?: number; outputTokens?: number };
  if (!data.text) throw new Error('Internal LLM service returned empty text');
  return {
    text: data.text,
    inputTokens: data.inputTokens ?? 0,
    outputTokens: data.outputTokens ?? 0,
  };
}

// ─── Public interface ────────────────────────────────────────────

const DEFAULT_MODELS: Record<LLMBackend, { primary: string; tiebreaker: string }> = {
  anthropic: { primary: 'claude-opus-4-6',   tiebreaker: 'claude-sonnet-4-6' },
  openai:    { primary: 'gpt-4o',            tiebreaker: 'gpt-4o-mini' },
  internal:  { primary: 'default',           tiebreaker: 'default' },
};

// Token pricing per million tokens: [input, output]
export const MODEL_PRICING: Record<string, [number, number]> = {
  'claude-opus-4-6':    [15, 75],
  'claude-sonnet-4-6':  [3, 15],
  'claude-haiku-4-5':   [0.80, 4],
  'gpt-4o':             [2.50, 10],
  'gpt-4o-mini':        [0.15, 0.60],
  'gpt-4.1-mini':       [0.40, 1.60],
  'gpt-4.1-nano':       [0.10, 0.40],
  'gemini-2.5-flash':   [0.15, 0.60],
  'deepseek-chat':      [0.27, 1.10],
};

export function estimateTokenCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  return (inputTokens * pricing[0] + outputTokens * pricing[1]) / 1_000_000;
}

export function getPrimaryModel(): string {
  const backend = getBackend();
  return process.env.SOLVER_MODEL_PRIMARY ?? DEFAULT_MODELS[backend].primary;
}

export function getTiebreakerModel(): string {
  const backend = getBackend();
  return process.env.SOLVER_MODEL_TIEBREAKER ?? DEFAULT_MODELS[backend].tiebreaker;
}

/**
 * Send a prompt to the configured LLM backend.
 * Returns text + token counts for cost tracking.
 */
export async function askLLM(systemPrompt: string, userPrompt: string, model: string): Promise<LLMResult> {
  const backend = getBackend();

  switch (backend) {
    case 'anthropic':
      return askAnthropic(systemPrompt, userPrompt, model);
    case 'openai':
      return askOpenAI(systemPrompt, userPrompt, model);
    case 'internal':
      return askInternal(systemPrompt, userPrompt, model);
  }
}
