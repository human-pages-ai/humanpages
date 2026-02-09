import { config } from './config.js';
import type { Message } from './types.js';

/**
 * Responder — generates replies to human messages.
 *
 * Three modes (auto-detected from environment):
 *
 *   1. Local LLM   — set OLLAMA_URL (e.g. http://localhost:11434)
 *   2. Claude API   — set ANTHROPIC_API_KEY
 *   3. No LLM       — keyword fallback, zero dependencies
 *
 * Priority: OLLAMA_URL > ANTHROPIC_API_KEY > keyword fallback.
 * All modes fall back to keywords on error so the bot never crashes.
 */

// ── Conversation history for LLM context ──

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const conversationHistory: ChatMessage[] = [];

// ── Public API ──

type Mode = 'ollama' | 'claude' | 'keyword';

function getMode(): Mode {
  if (config.ollamaUrl) return 'ollama';
  if (config.anthropicApiKey) return 'claude';
  return 'keyword';
}

/**
 * Generate a reply to a human message.
 * Picks the best available provider automatically.
 */
export async function generateReply(
  msg: Message,
  jobDescription: string,
): Promise<string> {
  const mode = getMode();
  if (mode === 'ollama') return callOllama(msg, jobDescription);
  if (mode === 'claude') return callClaude(msg, jobDescription);
  return keywordFallback(msg, jobDescription);
}

/** Returns which responder is active (for logging). */
export function getResponderName(): string {
  const mode = getMode();
  if (mode === 'ollama') return `Ollama (${config.llmModel}) at ${config.ollamaUrl}`;
  if (mode === 'claude') return `Claude (${config.llmModel})`;
  return 'keyword fallback (set OLLAMA_URL or ANTHROPIC_API_KEY for smart replies)';
}

// ── Shared ──

function getSystemPrompt(jobDescription: string): string {
  return config.llmSystemPrompt
    || `You are an AI agent that hires humans for physical-world tasks. You are friendly, concise, and helpful.

Your current job listing:
- Description: ${jobDescription}
- Price: $${config.jobPriceUsdc} USDC

Answer the human's questions about this job honestly. If you don't know specific details (like exact package weight), say so and give reasonable estimates. Keep replies short (1-3 sentences). Don't repeat the full job description unless asked.

If the human seems ready, encourage them to click "Accept" in the dashboard.`;
}

// ── Ollama / OpenAI-compatible responder ──

async function callOllama(msg: Message, jobDescription: string): Promise<string> {
  conversationHistory.push({ role: 'user', content: msg.content });

  const systemPrompt = getSystemPrompt(jobDescription);

  const body = {
    model: config.llmModel,
    messages: [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
    ],
    stream: false,
  };

  try {
    const res = await fetch(`${config.ollamaUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.log(`  [LLM] Ollama error: ${res.status} ${err.slice(0, 200)}`);
      conversationHistory.pop();
      return keywordFallback(msg, jobDescription);
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      conversationHistory.pop();
      return keywordFallback(msg, jobDescription);
    }

    conversationHistory.push({ role: 'assistant', content: reply });
    return reply;
  } catch (err) {
    console.log(`  [LLM] Ollama connection error: ${(err as Error).message}`);
    conversationHistory.pop();
    return keywordFallback(msg, jobDescription);
  }
}

// ── Claude responder ──

async function callClaude(msg: Message, jobDescription: string): Promise<string> {
  conversationHistory.push({ role: 'user', content: msg.content });

  const systemPrompt = getSystemPrompt(jobDescription);

  const body = {
    model: config.llmModel,
    max_tokens: 300,
    system: systemPrompt,
    messages: conversationHistory,
  };

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.anthropicApiKey!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.log(`  [LLM] Claude API error: ${res.status} ${(err as any).error?.message || res.statusText}`);
      conversationHistory.pop();
      return keywordFallback(msg, jobDescription);
    }

    const data = (await res.json()) as {
      content: Array<{ type: string; text: string }>;
    };

    const reply = data.content?.[0]?.text || keywordFallback(msg, jobDescription);
    conversationHistory.push({ role: 'assistant', content: reply });
    return reply;
  } catch (err) {
    console.log(`  [LLM] Claude connection error: ${(err as Error).message}`);
    conversationHistory.pop();
    return keywordFallback(msg, jobDescription);
  }
}

// ── Keyword fallback (no dependencies) ──

function keywordFallback(msg: Message, jobDescription: string): string {
  const lower = msg.content.toLowerCase();

  if (lower.includes('where') || lower.includes('address') || lower.includes('location')) {
    return `The pickup is at the address in the job description: ${jobDescription}`;
  }
  if (lower.includes('when') || lower.includes('time') || lower.includes('deadline')) {
    return 'No hard deadline — anytime today works. Just let me know when you start!';
  }
  if (lower.includes('price') || lower.includes('pay') || lower.includes('money') || lower.includes('rate')) {
    return `The offer is $${config.jobPriceUsdc} USDC, paid on-chain once you accept.`;
  }
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
    return `Hi ${msg.senderName}! Thanks for your interest. Feel free to ask any questions about the errand, or hit Accept when you're ready!`;
  }
  if (lower.includes('?')) {
    return `Good question! Here are the full details: ${jobDescription} — Let me know if anything else is unclear.`;
  }

  return `Thanks for the message, ${msg.senderName}! The task details are in the job description. Accept when you're ready and I'll send payment right away.`;
}
