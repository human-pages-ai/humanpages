import { decodeEventLog, type Log } from 'viem';
import {
  getPublicClient,
  getTokenAddress,
  getTokenConfig,
  getRequiredConfirmations,
  isNetworkSupported,
  isTokenSupportedOnNetwork,
  TRANSFER_EVENT_SIGNATURE,
  SUPPORTED_NETWORKS,
  type SupportedToken,
} from './chains.js';
import { PaymentVerificationError, PaymentErrorCode } from './errors.js';
import { logger } from '../logger.js';

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

export interface VerifyActivationPaymentParams {
  txHash: string;
  network: string;
  token?: string;
}

export interface ActivationVerificationResult {
  txHash: string;
  network: string;
  token: string;
  amount: number;
}

export async function verifyActivationPayment(
  params: VerifyActivationPaymentParams
): Promise<ActivationVerificationResult> {
  const { txHash, network, token = 'USDC' } = params;
  const networkLower = network.toLowerCase();
  const tokenUpper = token.toUpperCase() as SupportedToken;

  const depositAddress = process.env.AGENT_ACTIVATION_DEPOSIT_ADDRESS;
  const feeUsd = parseFloat(process.env.AGENT_ACTIVATION_FEE_USD || '10');

  if (!depositAddress) {
    throw new PaymentVerificationError(
      PaymentErrorCode.RPC_ERROR,
      'Activation deposit address not configured',
      { hint: 'Contact support' }
    );
  }

  if (!isNetworkSupported(networkLower)) {
    throw new PaymentVerificationError(
      PaymentErrorCode.UNSUPPORTED_NETWORK,
      `Network "${network}" is not supported`,
      { hint: `Supported networks: ${SUPPORTED_NETWORKS.join(', ')}` }
    );
  }

  if (!isTokenSupportedOnNetwork(tokenUpper, networkLower)) {
    throw new PaymentVerificationError(
      PaymentErrorCode.INVALID_TOKEN,
      `${tokenUpper} is not supported on ${network}`,
      {}
    );
  }

  const client = getPublicClient(networkLower);
  if (!client) {
    throw new PaymentVerificationError(
      PaymentErrorCode.RPC_ERROR,
      'Failed to create RPC client',
      { network }
    );
  }

  // Fetch transaction receipt
  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
  } catch (error: any) {
    if (error?.message?.includes('not found') || error?.message?.includes('could not be found')) {
      throw new PaymentVerificationError(
        PaymentErrorCode.TX_NOT_FOUND,
        'Transaction not found on chain',
        { txHash, network, hint: 'Ensure the transaction has been mined' }
      );
    }
    throw new PaymentVerificationError(
      PaymentErrorCode.RPC_ERROR,
      `RPC error: ${error?.message || 'Unknown'}`,
      { txHash, network }
    );
  }

  if (!receipt || receipt.status === 'reverted') {
    throw new PaymentVerificationError(
      PaymentErrorCode.TX_FAILED,
      'Transaction was reverted',
      { txHash, hint: 'Send a new payment' }
    );
  }

  // Check confirmations
  const currentBlock = await client.getBlockNumber();
  const confirmations = Number(currentBlock - receipt.blockNumber);
  const required = getRequiredConfirmations(networkLower);

  if (confirmations < required) {
    throw new PaymentVerificationError(
      PaymentErrorCode.TX_INSUFFICIENT_CONFIRMATIONS,
      `Transaction needs more confirmations (${confirmations}/${required})`,
      { confirmations, requiredConfirmations: required, hint: 'Wait and try again' }
    );
  }

  // Find token transfer to deposit address
  const tokenAddress = getTokenAddress(tokenUpper, networkLower);
  if (!tokenAddress) {
    throw new PaymentVerificationError(
      PaymentErrorCode.INVALID_TOKEN,
      `${tokenUpper} not configured for ${network}`,
      {}
    );
  }

  const transferLogs = receipt.logs.filter(
    (log: Log) =>
      log.address.toLowerCase() === tokenAddress.toLowerCase() &&
      log.topics[0] === TRANSFER_EVENT_SIGNATURE
  );

  if (transferLogs.length === 0) {
    throw new PaymentVerificationError(
      PaymentErrorCode.INVALID_TOKEN,
      `No ${tokenUpper} transfer found in transaction`,
      { hint: `Ensure you sent ${tokenUpper} using the official contract` }
    );
  }

  const normalizedDeposit = depositAddress.toLowerCase();
  let matchingTransfer: { amount: bigint } | null = null;

  for (const log of transferLogs) {
    try {
      const decoded = decodeEventLog({
        abi: transferEventAbi,
        data: log.data,
        topics: log.topics,
      });
      const toAddress = (decoded.args as any).to.toLowerCase();
      if (toAddress === normalizedDeposit) {
        matchingTransfer = { amount: (decoded.args as any).value };
        break;
      }
    } catch {
      continue;
    }
  }

  if (!matchingTransfer) {
    throw new PaymentVerificationError(
      PaymentErrorCode.RECIPIENT_MISMATCH,
      'Payment was not sent to the activation deposit address',
      { hint: `Send to ${depositAddress}` }
    );
  }

  const tokenConfig = getTokenConfig(tokenUpper);
  const decimals = tokenConfig?.decimals ?? 6;
  const actualAmount = Number(matchingTransfer.amount) / Math.pow(10, decimals);

  if (actualAmount < feeUsd) {
    throw new PaymentVerificationError(
      PaymentErrorCode.AMOUNT_INSUFFICIENT,
      `Payment amount ($${actualAmount.toFixed(2)}) is less than required fee ($${feeUsd})`,
      { actualAmount, expectedAmount: feeUsd }
    );
  }

  logger.info({ txHash, network: networkLower, token: tokenUpper, amount: actualAmount }, 'Activation payment verified');

  return {
    txHash,
    network: networkLower,
    token: tokenUpper,
    amount: actualAmount,
  };
}
