import { config } from './config.js';
import { notify } from './notify.js';
import type { Message } from './types.js';

/**
 * Responder — generates replies to human messages.
 *
 * Two LLM modes + keyword fallback:
 *
 *   1. OpenAI-compatible API — set LLM_BASE_URL (+ LLM_API_KEY if needed)
 *      Works with: Ollama, LM Studio, OpenRouter, Cloudflare Workers AI,
 *      Google Gemini, Together, Groq, Fireworks, vLLM, and more.
 *
 *   2. Anthropic native API — set LLM_BASE_URL=https://api.anthropic.com
 *      (auto-detected from URL; uses Anthropic's message format)
 *
 *   3. No LLM — keyword fallback, zero dependencies
 *
 * All modes fall back to keywords on error so the bot never crashes.
 */

// ── Conversation history for LLM context ──

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const conversationHistory: ChatMessage[] = [];

// ── Public API ──

function isAnthropic(): boolean {
  return config.llmBaseUrl.includes('anthropic.com');
}

/**
 * Generate a reply to a human message.
 * Picks the best available provider automatically.
 */
export async function generateReply(
  msg: Message,
  jobDescription: string,
): Promise<string> {
  if (!config.llmBaseUrl) return keywordFallback(msg, jobDescription);
  if (isAnthropic()) return callAnthropic(msg, jobDescription);
  return callOpenAICompat(msg, jobDescription);
}

/** Returns which responder is active (for logging). */
export function getResponderName(): string {
  if (!config.llmBaseUrl) {
    return 'keyword fallback (set LLM_BASE_URL for smart replies)';
  }
  if (isAnthropic()) {
    return `Anthropic (${config.llmModel})`;
  }
  return `${config.llmModel} via ${config.llmBaseUrl}`;
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

// ── OpenAI-compatible responder (works with most providers) ──

async function callOpenAICompat(msg: Message, jobDescription: string): Promise<string> {
  conversationHistory.push({ role: 'user', content: msg.content });

  const systemPrompt = getSystemPrompt(jobDescription);

  const body = {
    model: config.llmModel,
    messages: [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
    ],
    max_tokens: 300,
    stream: false,
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.llmApiKey) {
    headers['Authorization'] = `Bearer ${config.llmApiKey}`;
  }

  // Normalize the base URL — append /v1/chat/completions if it looks like a bare host
  let url = config.llmBaseUrl;
  if (!url.includes('/chat/completions')) {
    url = url.replace(/\/+$/, '') + '/v1/chat/completions';
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      const errorMsg = `${res.status} ${err.slice(0, 200)}`;
      console.log(`  [LLM] Error: ${errorMsg}`);
      notify.llmError(config.llmBaseUrl, errorMsg);
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
    const errorMsg = (err as Error).message;
    console.log(`  [LLM] Connection error: ${errorMsg}`);
    notify.llmError(config.llmBaseUrl, errorMsg);
    conversationHistory.pop();
    return keywordFallback(msg, jobDescription);
  }
}

// ── Anthropic native API (different request/response format) ──

async function callAnthropic(msg: Message, jobDescription: string): Promise<string> {
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
        'x-api-key': config.llmApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const errorMsg = `${res.status} ${(err as any).error?.message || res.statusText}`;
      console.log(`  [LLM] Anthropic error: ${errorMsg}`);
      notify.llmError('Anthropic', errorMsg);
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
    const errorMsg = (err as Error).message;
    console.log(`  [LLM] Anthropic connection error: ${errorMsg}`);
    notify.llmError('Anthropic', errorMsg);
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
