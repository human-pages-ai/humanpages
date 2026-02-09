import { config } from './config.js';
import type {
  Human,
  Job,
  Message,
  RegisterResponse,
  CreateJobResponse,
  PaidJobResponse,
  ReviewResponse,
} from './types.js';

// Retry delays in ms — exponential backoff matching the platform's webhook delivery pattern
const RETRY_DELAYS = [1000, 4000, 16000];

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string>;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query } = opts;

  let url = `${config.apiUrl}${path}`;
  if (query) {
    const params = new URLSearchParams(query);
    url += `?${params.toString()}`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.agentApiKey) {
    headers['X-Agent-Key'] = config.agentApiKey;
  }

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      // Don't retry client errors (4xx) — they won't succeed on retry
      if (res.status >= 400 && res.status < 500) {
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(
          `API ${res.status}: ${(errorBody as { error?: string }).error || res.statusText}`
        );
      }

      if (!res.ok) {
        throw new Error(`API ${res.status}: ${res.statusText}`);
      }

      return (await res.json()) as T;
    } catch (err) {
      lastError = err as Error;

      // Don't retry client errors
      if (lastError.message.startsWith('API 4')) {
        throw lastError;
      }

      // Wait before retry (if we have retries left)
      if (attempt < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[attempt];
        console.log(`  Retrying in ${delay}ms (attempt ${attempt + 2}/${RETRY_DELAYS.length + 1})...`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError!;
}

// ── API methods ──

export async function registerAgent(): Promise<RegisterResponse> {
  return request<RegisterResponse>('/api/agents/register', {
    method: 'POST',
    body: {
      name: config.agentName,
      description: config.agentDescription,
      contactEmail: config.agentContactEmail,
    },
  });
}

export async function searchHumans(params: {
  lat: number;
  lng: number;
  radius: number;
}): Promise<Human[]> {
  return request<Human[]>('/api/humans/search', {
    query: {
      lat: params.lat.toString(),
      lng: params.lng.toString(),
      radius: params.radius.toString(),
      available: 'true',
    },
  });
}

export async function getHuman(humanId: string): Promise<Human> {
  return request<Human>(`/api/humans/${humanId}`);
}

export async function getJob(jobId: string): Promise<Job> {
  return request<Job>(`/api/jobs/${jobId}`);
}

export async function createJob(params: {
  humanId: string;
  agentId: string;
  title: string;
  description: string;
  priceUsdc: number;
  callbackUrl?: string;
  callbackSecret?: string;
}): Promise<CreateJobResponse> {
  return request<CreateJobResponse>('/api/jobs', {
    method: 'POST',
    body: params,
  });
}

export async function markJobPaid(
  jobId: string,
  payment: {
    paymentTxHash: string;
    paymentNetwork: string;
    paymentToken?: string;
    paymentAmount: number;
  },
): Promise<PaidJobResponse> {
  return request<PaidJobResponse>(`/api/jobs/${jobId}/paid`, {
    method: 'PATCH',
    body: payment,
  });
}

export async function reviewJob(
  jobId: string,
  review: { rating: number; comment?: string },
): Promise<ReviewResponse> {
  return request<ReviewResponse>(`/api/jobs/${jobId}/review`, {
    method: 'POST',
    body: review,
  });
}

export async function sendMessage(jobId: string, content: string): Promise<Message> {
  return request<Message>(`/api/jobs/${jobId}/messages`, {
    method: 'POST',
    body: { content },
  });
}

export async function getMessages(jobId: string): Promise<Message[]> {
  return request<Message[]>(`/api/jobs/${jobId}/messages`);
}
