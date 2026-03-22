/**
 * Shared payment constants — single source of truth for platform names,
 * placeholders, and wallet validation used by both onboarding and dashboard.
 */

export const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function isValidEvmAddress(address: string): boolean {
  return EVM_ADDRESS_RE.test(address);
}

export interface PlatformOption {
  value: string;
  label: string;
  placeholder: string;
}

/**
 * Supported fiat payment platforms.
 * When adding a new platform (e.g. GCash), add it here — both onboarding
 * and dashboard will pick it up automatically.
 */
export const PLATFORM_OPTIONS: PlatformOption[] = [
  { value: 'PAYPAL', label: 'PayPal', placeholder: 'email@example.com' },
  { value: 'WISE', label: 'Wise', placeholder: 'email@example.com' },
  { value: 'VENMO', label: 'Venmo', placeholder: '@username' },
  { value: 'CASHAPP', label: 'Cash App', placeholder: '$cashtag' },
  { value: 'REVOLUT', label: 'Revolut', placeholder: '@username' },
  { value: 'ZELLE', label: 'Zelle', placeholder: 'email or phone' },
  { value: 'MONZO', label: 'Monzo', placeholder: '@username' },
  { value: 'N26', label: 'N26', placeholder: 'email@example.com' },
  { value: 'MERCADOPAGO', label: 'Mercado Pago', placeholder: 'email or phone' },
];

/** Platform value → display label lookup */
export const PLATFORM_LABELS: Record<string, string> = Object.fromEntries(
  PLATFORM_OPTIONS.map((p) => [p.value, p.label])
);

/** Platform value → input placeholder lookup */
export const PLATFORM_PLACEHOLDERS: Record<string, string> = Object.fromEntries(
  PLATFORM_OPTIONS.map((p) => [p.value, p.placeholder])
);
