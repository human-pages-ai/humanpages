import { decodeEventLog, type Log } from 'viem';
import { prisma } from '../prisma.js';
import {
  getPublicClient,
  getTokenAddress,
  getTokenConfig,
  getRequiredConfirmations,
  isNetworkSupported,
  isTokenSupportedOnNetwork,
  TRANSFER_EVENT_SIGNATURE,
  SUPPORTED_NETWORKS,
  SUPPORTED_TOKENS,
  type SupportedToken,
} from './chains.js';
import { PaymentVerificationError, PaymentErrorCode } from './errors.js';
import { logger as pinoLogger } from '../logger.js';

// ERC20 Transfer event ABI
const transferEventAbi = [
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
] as const;

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

// Logger interface for structured logging
interface PaymentLogger {
  info: (message: string, data?: Record<string, unknown>) => void;
  warn: (message: string, data?: Record<string, unknown>) => void;
  error: (message: string, data?: Record<string, unknown>) => void;
}

// Default logger using pino (structured, no console.log in production)
const defaultLogger: PaymentLogger = {
  info: (message, data) => {
    pinoLogger.info(data ?? {}, `[Payment] ${message}`);
  },
  warn: (message, data) => {
    pinoLogger.warn(data ?? {}, `[Payment] ${message}`);
  },
  error: (message, data) => {
    pinoLogger.error(data ?? {}, `[Payment] ${message}`);
  },
};

// Export for testing/custom loggers
export let logger = defaultLogger;
export function setLogger(customLogger: PaymentLogger) {
  logger = customLogger;
}

export interface VerifyPaymentParams {
  txHash: string;
  network: string;
  recipientWallets: string[];
  expectedAmount: number; // In token units (not raw decimals)
  jobId: string;
  token?: SupportedToken; // Defaults to USDC
}

export interface VerificationResult {
  verified: true;
  txHash: string;
  network: string;
  token: SupportedToken;
  from: string;
  to: string;
  amount: number;
  confirmations: number;
}

// Sleep helper for retry delays
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Calculate exponential backoff delay
function getRetryDelay(attempt: number): number {
  const delay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt);
  return Math.min(delay, RETRY_CONFIG.maxDelayMs);
}

// Retry wrapper for RPC calls
async function withRetry<T>(
  operation: () => Promise<T>,
  context: string
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      // Don't retry on known non-transient errors
      const errorMessage = error?.message?.toLowerCase() || '';
      const isNonTransient =
        errorMessage.includes('not found') ||
        errorMessage.includes('could not be found') ||
        errorMessage.includes('does not exist') ||
        errorMessage.includes('invalid') ||
        errorMessage.includes('reverted');
      if (isNonTransient) {
        throw error;
      }

      if (attempt < RETRY_CONFIG.maxRetries) {
        const delay = getRetryDelay(attempt);
        logger.warn(`RPC retry ${attempt + 1}/${RETRY_CONFIG.maxRetries}`, {
          context,
          delay,
          error: error?.message,
        });
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

export async function verifyUsdcPayment(params: VerifyPaymentParams): Promise<VerificationResult> {
  const {
    txHash,
    network,
    recipientWallets,
    expectedAmount,
    jobId,
    token = 'USDC',
  } = params;
  const networkLower = network.toLowerCase();
  const tokenUpper = token.toUpperCase() as SupportedToken;

  const logContext = { txHash, network: networkLower, token: tokenUpper, jobId };

  logger.info('Starting payment verification', logContext);

  // 1. Validate network is supported
  if (!isNetworkSupported(networkLower)) {
    logger.warn('Unsupported network', logContext);
    throw new PaymentVerificationError(
      PaymentErrorCode.UNSUPPORTED_NETWORK,
      `Network "${network}" is not supported for stablecoin payments`,
      {
        network,
        hint: `Supported networks: ${SUPPORTED_NETWORKS.join(', ')}`,
      }
    );
  }

  // 2. Validate token is supported on this network
  if (!isTokenSupportedOnNetwork(tokenUpper, networkLower)) {
    logger.warn('Token not supported on network', { ...logContext, supportedTokens: SUPPORTED_TOKENS });
    throw new PaymentVerificationError(
      PaymentErrorCode.INVALID_TOKEN,
      `${tokenUpper} is not supported on ${network}`,
      {
        network,
        hint: `Supported tokens: ${SUPPORTED_TOKENS.join(', ')}`,
      }
    );
  }

  // 3. Check txHash not already used (query DB)
  const existingJob = await prisma.job.findFirst({
    where: {
      paymentTxHash: txHash,
      id: { not: jobId },
    },
    select: { id: true },
  });

  if (existingJob) {
    logger.warn('Duplicate txHash detected', { ...logContext, existingJobId: existingJob.id });
    throw new PaymentVerificationError(
      PaymentErrorCode.TX_ALREADY_USED,
      'This transaction hash has already been used for another payment',
      {
        txHash,
        hint: 'Each transaction can only be used once',
      }
    );
  }

  // Also check StreamTick for duplicate txHash (micro-transfer stream payments)
  const existingTick = await prisma.streamTick.findUnique({ where: { txHash } });
  if (existingTick) {
    logger.warn('Duplicate txHash detected in stream tick', { ...logContext, tickId: existingTick.id });
    throw new PaymentVerificationError(
      PaymentErrorCode.TX_ALREADY_USED,
      'This transaction hash has already been used for a stream payment',
      {
        txHash,
        hint: 'Each transaction can only be used once',
      }
    );
  }

  // 4. Get public client for the network
  const client = getPublicClient(networkLower);
  if (!client) {
    logger.error('Failed to create RPC client', logContext);
    throw new PaymentVerificationError(
      PaymentErrorCode.RPC_ERROR,
      'Failed to create RPC client for network',
      { network }
    );
  }

  // 5. Fetch transaction receipt from RPC (with retry)
  let receipt;
  try {
    receipt = await withRetry(
      () => client.getTransactionReceipt({ hash: txHash as `0x${string}` }),
      'getTransactionReceipt'
    );
  } catch (error: any) {
    if (error?.message?.includes('could not be found') || error?.message?.includes('not found')) {
      logger.warn('Transaction not found', logContext);
      throw new PaymentVerificationError(
        PaymentErrorCode.TX_NOT_FOUND,
        'Transaction not found on chain',
        {
          txHash,
          network,
          hint: 'Ensure the transaction has been mined and the network is correct',
        }
      );
    }
    logger.error('RPC error fetching receipt', { ...logContext, error: error?.message });
    throw new PaymentVerificationError(
      PaymentErrorCode.RPC_ERROR,
      `RPC error: ${error?.message || 'Unknown error'}`,
      { txHash, network }
    );
  }

  if (!receipt) {
    logger.warn('Transaction receipt null', logContext);
    throw new PaymentVerificationError(
      PaymentErrorCode.TX_NOT_FOUND,
      'Transaction not found on chain',
      {
        txHash,
        network,
        hint: 'Ensure the transaction has been mined and the network is correct',
      }
    );
  }

  // 6. Verify tx status is success (not reverted)
  if (receipt.status === 'reverted') {
    logger.warn('Transaction reverted', logContext);
    throw new PaymentVerificationError(
      PaymentErrorCode.TX_FAILED,
      'Transaction was reverted on chain',
      {
        txHash,
        network,
        hint: 'The transaction failed. Please send a new payment.',
      }
    );
  }

  // 7. Check sufficient confirmations (with retry)
  let currentBlock;
  try {
    currentBlock = await withRetry(() => client.getBlockNumber(), 'getBlockNumber');
  } catch (error: any) {
    logger.error('RPC error fetching block number', { ...logContext, error: error?.message });
    throw new PaymentVerificationError(
      PaymentErrorCode.RPC_ERROR,
      `RPC error fetching block number: ${error?.message || 'Unknown error'}`,
      { txHash, network }
    );
  }

  const confirmations = Number(currentBlock - receipt.blockNumber);
  const requiredConfirmations = getRequiredConfirmations(networkLower);

  if (confirmations < requiredConfirmations) {
    logger.info('Insufficient confirmations', { ...logContext, confirmations, requiredConfirmations });
    throw new PaymentVerificationError(
      PaymentErrorCode.TX_INSUFFICIENT_CONFIRMATIONS,
      `Transaction needs more confirmations (${confirmations}/${requiredConfirmations})`,
      {
        txHash,
        network,
        confirmations,
        requiredConfirmations,
        hint: 'Please wait for more block confirmations and try again',
      }
    );
  }

  // 8. Find token Transfer events in logs
  const tokenAddress = getTokenAddress(tokenUpper, networkLower);
  if (!tokenAddress) {
    throw new PaymentVerificationError(
      PaymentErrorCode.INVALID_TOKEN,
      `${tokenUpper} address not configured for ${network}`,
      { network }
    );
  }

  // Filter logs for token Transfer events
  const transferLogs = receipt.logs.filter(
    (log: Log) =>
      log.address.toLowerCase() === tokenAddress.toLowerCase() &&
      log.topics[0] === TRANSFER_EVENT_SIGNATURE
  );

  if (transferLogs.length === 0) {
    logger.warn('No token transfer found in tx', { ...logContext, tokenAddress });
    throw new PaymentVerificationError(
      PaymentErrorCode.INVALID_TOKEN,
      `No ${tokenUpper} transfer found in this transaction`,
      {
        txHash,
        network,
        hint: `Ensure you sent ${tokenUpper} using the official contract`,
      }
    );
  }

  // Normalize wallet addresses for comparison (case-insensitive)
  const normalizedWallets = recipientWallets.map((w) => w.toLowerCase());

  // 9. Find a transfer to one of the registered wallets
  let matchingTransfer: { from: string; to: string; amount: bigint } | null = null;

  for (const log of transferLogs) {
    try {
      const decoded = decodeEventLog({
        abi: transferEventAbi,
        data: log.data,
        topics: log.topics,
      });

      const toAddress = (decoded.args as any).to.toLowerCase();

      if (normalizedWallets.includes(toAddress)) {
        matchingTransfer = {
          from: (decoded.args as any).from,
          to: (decoded.args as any).to,
          amount: (decoded.args as any).value,
        };
        break;
      }
    } catch {
      // Skip logs that can't be decoded
      continue;
    }
  }

  if (!matchingTransfer) {
    logger.warn('Recipient mismatch', { ...logContext, registeredWallets: recipientWallets });
    throw new PaymentVerificationError(
      PaymentErrorCode.RECIPIENT_MISMATCH,
      "Payment was not sent to any of the human's registered wallets",
      {
        txHash,
        network,
        registeredWallets: recipientWallets,
        hint: 'Ensure payment was sent to a wallet registered by this human',
      }
    );
  }

  // 10. Verify amount >= agreed job price
  const tokenConfig = getTokenConfig(tokenUpper);
  const decimals = tokenConfig?.decimals ?? 6;
  const actualAmount = Number(matchingTransfer.amount) / Math.pow(10, decimals);

  if (actualAmount < expectedAmount) {
    logger.warn('Insufficient payment amount', { ...logContext, actualAmount, expectedAmount });
    throw new PaymentVerificationError(
      PaymentErrorCode.AMOUNT_INSUFFICIENT,
      `Payment amount ($${actualAmount.toFixed(2)}) is less than agreed price ($${expectedAmount.toFixed(2)})`,
      {
        txHash,
        network,
        expectedAmount,
        actualAmount,
        hint: 'Payment must match or exceed the agreed price',
      }
    );
  }

  // 11. Success!
  logger.info('Payment verified successfully', {
    ...logContext,
    from: matchingTransfer.from,
    to: matchingTransfer.to,
    amount: actualAmount,
    confirmations,
  });

  return {
    verified: true,
    txHash,
    network: networkLower,
    token: tokenUpper,
    from: matchingTransfer.from,
    to: matchingTransfer.to,
    amount: actualAmount,
    confirmations,
  };
}
