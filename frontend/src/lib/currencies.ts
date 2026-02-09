export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
}

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '\u20AC', name: 'Euro' },
  { code: 'GBP', symbol: '\u00A3', name: 'British Pound' },
  { code: 'TRY', symbol: '\u20BA', name: 'Turkish Lira' },
  { code: 'PHP', symbol: '\u20B1', name: 'Philippine Peso' },
  { code: 'INR', symbol: '\u20B9', name: 'Indian Rupee' },
  { code: 'VND', symbol: '\u20AB', name: 'Vietnamese Dong' },
  { code: 'THB', symbol: '\u0E3F', name: 'Thai Baht' },
  { code: 'CNY', symbol: '\u00A5', name: 'Chinese Yuan' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
];

export function getCurrencySymbol(code: string): string {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code)?.symbol || code;
}

export function getCurrencyInfo(code: string): CurrencyInfo | undefined {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code);
}

export function formatCurrencyAmount(
  amount: number | string,
  currency: string,
  unit?: string | null,
  usdEstimate?: number | null,
): string {
  const sym = getCurrencySymbol(currency);
  const num = typeof amount === 'string' ? amount : amount.toString();
  const isUsd = currency === 'USD';

  let base = `${sym}${num}`;
  if (unit === 'HOURLY') base += '/hr';
  else if (unit === 'FLAT_TASK') base += '/task';

  if (!isUsd && usdEstimate != null) {
    base += ` (~$${Math.round(usdEstimate)} USD)`;
  }

  return base;
}
