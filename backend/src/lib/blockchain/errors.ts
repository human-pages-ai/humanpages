// Payment verification error codes
export const PaymentErrorCode = {
  TX_NOT_FOUND: 'TX_NOT_FOUND',
  TX_FAILED: 'TX_FAILED',
  TX_INSUFFICIENT_CONFIRMATIONS: 'TX_INSUFFICIENT_CONFIRMATIONS',
  INVALID_TOKEN: 'INVALID_TOKEN',
  RECIPIENT_MISMATCH: 'RECIPIENT_MISMATCH',
  AMOUNT_INSUFFICIENT: 'AMOUNT_INSUFFICIENT',
  TX_ALREADY_USED: 'TX_ALREADY_USED',
  UNSUPPORTED_NETWORK: 'UNSUPPORTED_NETWORK',
  RPC_ERROR: 'RPC_ERROR',
} as const;

export type PaymentErrorCode = typeof PaymentErrorCode[keyof typeof PaymentErrorCode];

export interface PaymentErrorDetails {
  txHash?: string;
  network?: string;
  registeredWallets?: string[];
  expectedAmount?: number;
  actualAmount?: number;
  confirmations?: number;
  requiredConfirmations?: number;
  hint?: string;
}

export class PaymentVerificationError extends Error {
  code: PaymentErrorCode;
  details: PaymentErrorDetails;

  constructor(code: PaymentErrorCode, reason: string, details: PaymentErrorDetails = {}) {
    super(reason);
    this.name = 'PaymentVerificationError';
    this.code = code;
    this.details = details;
  }

  toResponse() {
    return {
      error: 'Payment verification failed',
      code: this.code,
      reason: this.message,
      details: this.details,
    };
  }
}
