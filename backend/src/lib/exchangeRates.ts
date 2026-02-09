import { logger } from './logger.js';

export const SUPPORTED_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'TRY', 'PHP', 'INR', 'VND', 'THB', 'CNY', 'MXN',
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

// Hardcoded fallback rates (USD to X) - updated periodically
const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  TRY: 36.5,
  PHP: 57.5,
  INR: 85.0,
  VND: 25400,
  THB: 34.5,
  CNY: 7.25,
  MXN: 17.5,
};

interface RateCache {
  rates: Record<string, number>;
  fetchedAt: number;
}

let cache: RateCache | null = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

async function fetchRates(): Promise<Record<string, number>> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rates;
  }

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!res.ok) throw new Error(`Exchange rate API returned ${res.status}`);
    const data = (await res.json()) as { rates?: Record<string, number> };
    if (!data.rates) throw new Error('No rates in response');

    cache = { rates: data.rates, fetchedAt: now };
    logger.info('Exchange rates refreshed from API');
    return data.rates;
  } catch (err) {
    logger.warn({ err }, 'Failed to fetch exchange rates, using fallback');
    return FALLBACK_RATES;
  }
}

export async function getRates(): Promise<Record<string, number>> {
  return fetchRates();
}

export async function convertToUsd(amount: number, currency: string): Promise<number> {
  if (currency === 'USD') return amount;
  const rates = await fetchRates();
  const rate = rates[currency];
  if (!rate || rate === 0) {
    logger.warn({ currency }, 'Unknown currency, treating as USD');
    return amount;
  }
  return amount / rate;
}

export function convertToUsdSync(amount: number, currency: string, rates: Record<string, number>): number {
  if (currency === 'USD') return amount;
  const rate = rates[currency];
  if (!rate || rate === 0) return amount;
  return amount / rate;
}

export function isSupportedCurrency(code: string): code is SupportedCurrency {
  return SUPPORTED_CURRENCIES.includes(code as SupportedCurrency);
}
