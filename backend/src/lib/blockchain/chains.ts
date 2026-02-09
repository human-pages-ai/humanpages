import { createPublicClient, http, fallback, type Chain, type PublicClient } from 'viem';
import { mainnet, base, polygon, arbitrum, baseSepolia } from 'viem/chains';

// Supported stablecoin tokens
export type SupportedToken = 'USDC' | 'USDT' | 'DAI';

// Token configuration
interface TokenConfig {
  symbol: SupportedToken;
  decimals: number;
  addresses: Record<string, `0x${string}`>;
}

// Official token contract addresses
// Sources:
// - USDC: https://developers.circle.com/stablecoins/usdc-on-main-networks
// - USDT: https://tether.to/en/supported-protocols/
// - DAI: https://docs.makerdao.com/smart-contract-modules/dai-module
export const TOKEN_CONFIGS: Record<SupportedToken, TokenConfig> = {
  USDC: {
    symbol: 'USDC',
    decimals: 6,
    addresses: {
      ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
      arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    },
  },
  USDT: {
    symbol: 'USDT',
    decimals: 6,
    addresses: {
      ethereum: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      polygon: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      arbitrum: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      // Note: USDT not natively on Base (bridged versions exist but not official)
    },
  },
  DAI: {
    symbol: 'DAI',
    decimals: 18, // DAI has 18 decimals unlike USDC/USDT
    addresses: {
      ethereum: '0x6B175474E89094C44Da98b954EescdeCB5AC0eF',
      base: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
      polygon: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
      arbitrum: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    },
  },
};

// For backwards compatibility
export const USDC_ADDRESSES = TOKEN_CONFIGS.USDC.addresses;
export const USDC_DECIMALS = TOKEN_CONFIGS.USDC.decimals;

export const SUPPORTED_TOKENS = Object.keys(TOKEN_CONFIGS) as SupportedToken[];

// ERC20 Transfer event signature: Transfer(address,address,uint256)
export const TRANSFER_EVENT_SIGNATURE = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// Chain configurations with fallback RPCs
interface ChainConfig {
  chain: Chain;
  confirmations: number;
  rpcEnvVar: string;
  defaultRpcs: string[]; // Multiple RPCs for fallback
}

const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  ethereum: {
    chain: mainnet,
    confirmations: 12, // Conservative for mainnet
    rpcEnvVar: 'ETHEREUM_RPC_URL',
    defaultRpcs: [
      'https://eth.llamarpc.com',
      'https://rpc.ankr.com/eth',
      'https://ethereum.publicnode.com',
    ],
  },
  base: {
    chain: base,
    confirmations: 10,
    rpcEnvVar: 'BASE_RPC_URL',
    defaultRpcs: [
      'https://mainnet.base.org',
      'https://base.llamarpc.com',
      'https://base.publicnode.com',
    ],
  },
  polygon: {
    chain: polygon,
    confirmations: 10,
    rpcEnvVar: 'POLYGON_RPC_URL',
    defaultRpcs: [
      'https://polygon-rpc.com',
      'https://rpc.ankr.com/polygon',
      'https://polygon-bor-rpc.publicnode.com',
    ],
  },
  arbitrum: {
    chain: arbitrum,
    confirmations: 10,
    rpcEnvVar: 'ARBITRUM_RPC_URL',
    defaultRpcs: [
      'https://arb1.arbitrum.io/rpc',
      'https://arbitrum.llamarpc.com',
      'https://arbitrum-one.publicnode.com',
    ],
  },
  'base-sepolia': {
    chain: baseSepolia,
    confirmations: 2,
    rpcEnvVar: 'BASE_SEPOLIA_RPC_URL',
    defaultRpcs: [
      'https://sepolia.base.org',
    ],
  },
};

export const SUPPORTED_NETWORKS = Object.keys(CHAIN_CONFIGS);

export function isNetworkSupported(network: string): boolean {
  return network.toLowerCase() in CHAIN_CONFIGS;
}

export function getChainConfig(network: string): ChainConfig | undefined {
  return CHAIN_CONFIGS[network.toLowerCase()];
}

export function getTokenConfig(token: string): TokenConfig | undefined {
  return TOKEN_CONFIGS[token.toUpperCase() as SupportedToken];
}

export function getTokenAddress(token: string, network: string): `0x${string}` | undefined {
  const config = getTokenConfig(token);
  return config?.addresses[network.toLowerCase()];
}

// Backwards compatibility
export function getUsdcAddress(network: string): `0x${string}` | undefined {
  return getTokenAddress('USDC', network);
}

export function getRequiredConfirmations(network: string): number {
  const config = getChainConfig(network);
  return config?.confirmations ?? 12;
}

// Get RPC URLs for a network (from env or defaults)
export function getRpcUrls(network: string): string[] {
  const config = getChainConfig(network);
  if (!config) return [];

  // Check for user-configured RPCs (comma-separated)
  const envRpcs = process.env[config.rpcEnvVar];
  if (envRpcs) {
    const urls = envRpcs.split(',').map((url) => url.trim()).filter(Boolean);
    if (urls.length > 0) {
      // User RPCs first, then defaults as fallback
      return [...urls, ...config.defaultRpcs];
    }
  }

  return config.defaultRpcs;
}

// Create a public client with fallback RPC support
export function getPublicClient(network: string): PublicClient | null {
  const config = getChainConfig(network);
  if (!config) return null;

  const rpcUrls = getRpcUrls(network);
  if (rpcUrls.length === 0) return null;

  // Create fallback transport with multiple RPCs
  const transports = rpcUrls.map((url) =>
    http(url, {
      timeout: 10_000, // 10 second timeout per request
      retryCount: 0, // We handle retries at higher level
    })
  );

  return createPublicClient({
    chain: config.chain,
    transport: fallback(transports, {
      rank: true, // Automatically rank RPCs by latency
      retryCount: 1, // Retry once on each transport before moving to next
    }),
  });
}

// Get all supported tokens for a network
export function getSupportedTokensForNetwork(network: string): SupportedToken[] {
  const networkLower = network.toLowerCase();
  return SUPPORTED_TOKENS.filter((token) => {
    const config = TOKEN_CONFIGS[token];
    return networkLower in config.addresses;
  });
}

// Check if a token is supported on a network
export function isTokenSupportedOnNetwork(token: string, network: string): boolean {
  const address = getTokenAddress(token, network);
  return address !== undefined;
}
