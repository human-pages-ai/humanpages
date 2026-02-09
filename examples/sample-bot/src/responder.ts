import { config } from './config.js';
import type { Message } from './types.js';

/**
 * Responder — generates replies to human messages.
 *
 * If ANTHROPIC_API_KEY is set, uses Claude for intelligent, context-aware replies.
 * Otherwise, falls back to simple keyword matching (no external dependencies).
 *
 * To use a different LLM, replace the `callClaude` function or add your own
 * provider (OpenAI, Gemini, local model, etc.) — see README for examples.
 */

// ── Conversation history for LLM context ──

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const conversationHistory: ChatMessage[] = [];

// ── Public API ──

/**
 * Generate a reply to a human message.
 * Automatically picks Claude (if configured) or keyword fallback.
 */
export async function generateReply(
  msg: Message,
  jobDescription: string,
): Promise<string> {
  if (config.anthropicApiKey) {
    return callClaude(msg, jobDescription);
  }
  return keywordFallback(msg, jobDescription);
}

/** Returns which responder is active (for logging). */
export function getResponderName(): string {
  if (config.anthropicApiKey) {
    return `Claude (${config.llmModel})`;
  }
  return 'keyword fallback (set ANTHROPIC_API_KEY for smart replies)';
}

// ── Claude responder ──

async function callClaude(msg: Message, jobDescription: string): Promise<string> {
  conversationHistory.push({ role: 'user', content: msg.content });

  const systemPrompt = config.llmSystemPrompt
    || `You are an AI agent that hires humans for physical-world tasks. You are friendly, concise, and helpful.

Your current job listing:
- Description: ${jobDescription}
- Price: $${config.jobPriceUsdc} USDC

Answer the human's questions about this job honestly. If you don't know specific details (like exact package weight), say so and give reasonable estimates. Keep replies short (1-3 sentences). Don't repeat the full job description unless asked.

If the human seems ready, encourage them to click "Accept" in the dashboard.`;

  const body = {
    model: config.llmModel,
    max_tokens: 300,
    system: systemPrompt,
    messages: conversationHistory,
  };

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
    // Fall back to keyword matcher on API error
    conversationHistory.pop();
    return keywordFallback(msg, jobDescription);
  }

  const data = (await res.json()) as {
    content: Array<{ type: string; text: string }>;
  };

  const reply = data.content?.[0]?.text || keywordFallback(msg, jobDescription);
  conversationHistory.push({ role: 'assistant', content: reply });

  return reply;
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
