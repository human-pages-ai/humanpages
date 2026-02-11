// Re-exports for blockchain module
export {
  // Token configs
  TOKEN_CONFIGS,
  USDC_ADDRESSES,
  USDC_DECIMALS,
  SUPPORTED_TOKENS,
  TRANSFER_EVENT_SIGNATURE,
  SUPPORTED_NETWORKS,
  EVM_MAINNET_NETWORKS,
  // Functions
  isNetworkSupported,
  isTokenSupportedOnNetwork,
  getChainConfig,
  getTokenConfig,
  getTokenAddress,
  getUsdcAddress,
  getRequiredConfirmations,
  getRpcUrls,
  getPublicClient,
  getSupportedTokensForNetwork,
  // Types
  type SupportedToken,
} from './chains.js';

export {
  PaymentVerificationError,
  PaymentErrorCode,
  type PaymentErrorDetails,
} from './errors.js';

export {
  verifyUsdcPayment,
  setLogger,
  logger,
  type VerifyPaymentParams,
  type VerificationResult,
} from './verify-payment.js';
