import { getPublicClient } from './chains.js';
import { logger as appLogger } from '../logger.js';

// Same address on ALL EVM chains
export const CFA_V1_FORWARDER = '0xcfA132E353cB4E398080B9700609bb008eceB125' as const;

// Super Token addresses (USDCx) per chain
export const SUPER_TOKEN_ADDRESSES: Record<string, Record<string, `0x${string}`>> = {
  ethereum: { USDC: '0x1BA8603DA702602A8657980e825A6DAa03Dee93a' },
  base:     { USDC: '0xD04383398dD2426297da660F9CCA3d439AF9ce1b' },
  polygon:  { USDC: '0xCAa7349CEA390F89641fe306D93591f87595dc1F' },
  arbitrum: { USDC: '0x1dbc1809486460dcd189b8a15990bca3272ee04e' },
};

// Minimal ABI for CFAv1Forwarder read functions
const cfaV1ForwarderABI = [
  {
    name: 'getFlowrate',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'sender', type: 'address' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [{ name: 'flowrate', type: 'int96' }],
  },
  {
    name: 'getFlowInfo',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'sender', type: 'address' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [
      { name: 'lastUpdated', type: 'uint256' },
      { name: 'flowrate', type: 'int96' },
      { name: 'deposit', type: 'uint256' },
      { name: 'owedDeposit', type: 'uint256' },
    ],
  },
] as const;

// Seconds per interval for flow rate calculations
const SECONDS_PER_INTERVAL: Record<string, number> = {
  HOURLY: 3600,
  DAILY: 86400,
  WEEKLY: 604800,
};

// USDCx uses 18 decimals (Super Tokens always use 18 decimals)
const SUPER_TOKEN_DECIMALS = 18;

export interface FlowInfo {
  lastUpdated: bigint;
  flowRate: bigint;
  deposit: bigint;
  owedDeposit: bigint;
}

export interface VerifyFlowParams {
  network: string;
  superToken: string;
  sender: string;
  receiver: string;
  expectedFlowRate?: string; // wei/sec as string
}

export interface VerifyFlowResult {
  active: boolean;
  flowRate: string;
  lastUpdated: number;
  deposit: string;
  matchesExpected: boolean;
}

/**
 * Get the Super Token address for a given network and base token
 */
export function getSuperTokenAddress(network: string, token: string): `0x${string}` | undefined {
  const networkLower = network.toLowerCase();
  const tokenUpper = token.toUpperCase();
  return SUPER_TOKEN_ADDRESSES[networkLower]?.[tokenUpper];
}

/**
 * Convert USDC amount per interval to wei/sec flow rate
 * Example: $10/day → flow rate in wei/sec (18 decimals)
 */
export function usdcPerIntervalToFlowRate(amount: number, interval: string): string {
  const seconds = SECONDS_PER_INTERVAL[interval];
  if (!seconds) throw new Error(`Unsupported interval: ${interval}`);

  // amount is in USDC (6 decimals), but Super Tokens use 18 decimals
  // Convert to 18-decimal wei, then divide by seconds
  const amountWei = BigInt(Math.round(amount * 1e18));
  const flowRate = amountWei / BigInt(seconds);
  return flowRate.toString();
}

/**
 * Convert wei/sec flow rate to USDC amount per interval
 */
export function flowRateToUsdcPerInterval(flowRate: string, interval: string): number {
  const seconds = SECONDS_PER_INTERVAL[interval];
  if (!seconds) throw new Error(`Unsupported interval: ${interval}`);

  const flowRateBig = BigInt(flowRate);
  const amountWei = flowRateBig * BigInt(seconds);
  return Number(amountWei) / 1e18;
}

/**
 * Calculate total streamed since flow started
 */
export function calculateTotalStreamed(flowRate: string, lastUpdated: number): number {
  const now = Math.floor(Date.now() / 1000);
  const elapsed = now - lastUpdated;
  if (elapsed <= 0) return 0;

  const totalWei = BigInt(flowRate) * BigInt(elapsed);
  return Number(totalWei) / 1e18;
}

/**
 * Get flow info from on-chain CFAv1Forwarder
 */
export async function getFlowInfo(params: {
  network: string;
  superToken: string;
  sender: string;
  receiver: string;
}): Promise<FlowInfo> {
  const client = getPublicClient(params.network.toLowerCase());
  if (!client) {
    throw new Error(`No RPC client for network: ${params.network}`);
  }

  const result = await client.readContract({
    address: CFA_V1_FORWARDER,
    abi: cfaV1ForwarderABI,
    functionName: 'getFlowInfo',
    args: [
      params.superToken as `0x${string}`,
      params.sender as `0x${string}`,
      params.receiver as `0x${string}`,
    ],
  });

  return {
    lastUpdated: result[0],
    flowRate: result[1],
    deposit: result[2],
    owedDeposit: result[3],
  };
}

/**
 * Verify that a Superfluid flow exists with correct parameters
 */
export async function verifyFlow(params: VerifyFlowParams): Promise<VerifyFlowResult> {
  const flowInfo = await getFlowInfo({
    network: params.network,
    superToken: params.superToken,
    sender: params.sender,
    receiver: params.receiver,
  });

  const flowRate = flowInfo.flowRate.toString();
  const active = flowInfo.flowRate > 0n;

  let matchesExpected = true;
  if (params.expectedFlowRate && active) {
    // Allow 1% tolerance for rounding differences
    const expected = BigInt(params.expectedFlowRate);
    const actual = flowInfo.flowRate;
    const diff = expected > actual ? expected - actual : actual - expected;
    const tolerance = expected / 100n || 1n;
    matchesExpected = diff <= tolerance;
  }

  return {
    active,
    flowRate,
    lastUpdated: Number(flowInfo.lastUpdated),
    deposit: flowInfo.deposit.toString(),
    matchesExpected,
  };
}

/**
 * Quick boolean check if a flow is active
 */
export async function isFlowActive(params: {
  network: string;
  superToken: string;
  sender: string;
  receiver: string;
}): Promise<boolean> {
  try {
    const result = await verifyFlow(params);
    return result.active;
  } catch (err) {
    appLogger.error({ err, ...params }, 'Error checking flow status');
    return false;
  }
}
