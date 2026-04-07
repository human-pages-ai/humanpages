/**
 * Escrow contract interaction service.
 * Reads escrow state from the AgentEscrow contract on Base (or Base Sepolia).
 * Writes (markComplete, release, forceRelease, resolve) via relayer wallet.
 *
 * Chain selection via ESCROW_CHAIN env var: "base" (default) or "base-sepolia".
 */
import { createPublicClient, createWalletClient, http, parseAbi, type Hex, keccak256, encodePacked, encodeAbiParameters, parseAbiParameters } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { logger } from '../logger.js';

// ======================== CONFIG ========================

const ESCROW_CHAIN_NAME = process.env.ESCROW_CHAIN || 'base';
const IS_TESTNET = ESCROW_CHAIN_NAME === 'base-sepolia';
const ESCROW_CHAIN = IS_TESTNET ? baseSepolia : base;
const ESCROW_RPC_URL = IS_TESTNET
  ? (process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org')
  : (process.env.BASE_RPC_URL || 'https://mainnet.base.org');
const ESCROW_CONTRACT = (IS_TESTNET
  ? process.env.ESCROW_CONTRACT_BASE_SEPOLIA
  : process.env.ESCROW_CONTRACT_BASE) as Hex | undefined;
const RELAYER_KEY = process.env.ESCROW_RELAYER_PRIVATE_KEY as Hex | undefined;

const ESCROW_ABI = parseAbi([
  // Read
  'function getEscrow(bytes32 jobId) view returns ((address depositor, address payee, address arbitrator, uint256 amount, uint256 arbitratorFeeBps, uint8 state, uint256 fundedAt, uint256 completedAt, uint32 disputeWindow, uint256 disputedAt))',
  'function getDisputeDeadline(bytes32 jobId) view returns (uint256)',
  'function getArbitratorTimeout(bytes32 jobId) view returns (uint256)',
  'function escrows(bytes32) view returns (address depositor, address payee, address arbitrator, uint256 amount, uint256 arbitratorFeeBps, uint8 state, uint256 fundedAt, uint256 completedAt, uint32 disputeWindow, uint256 disputedAt)',
  // Write (relayer)
  'function markComplete(bytes32 jobId)',
  'function release(bytes32 jobId)',
  'function forceRelease(bytes32 jobId)',
  'function resolve(bytes32 jobId, uint256 toPayee, uint256 toDepositor, uint256 arbitratorFee, uint256 nonce, bytes signature)',
  'function acceptCancel(bytes32 jobId)',
  // Events
  'event Deposited(bytes32 indexed jobId, address indexed depositor, address indexed payee, uint256 amount, address arbitrator, uint256 arbitratorFeeBps, uint32 disputeWindow)',
  'event Completed(bytes32 indexed jobId, uint256 disputeDeadline)',
  'event Released(bytes32 indexed jobId, address indexed payee, uint256 amount, address releasedBy)',
  'event Disputed(bytes32 indexed jobId, address disputedBy)',
  'event Resolved(bytes32 indexed jobId, uint256 toPayee, uint256 toDepositor, uint256 arbitratorFee, address arbitrator)',
  'event ForceReleased(bytes32 indexed jobId, address indexed payee, uint256 amount)',
  'event CancelAccepted(bytes32 indexed jobId)',
]);

// Escrow state enum matching Solidity
export const EscrowState = {
  Empty: 0,
  Funded: 1,
  Completed: 2,
  Released: 3,
  Cancelled: 4,
  Disputed: 5,
  Resolved: 6,
} as const;

export const EscrowStateNames = ['Empty', 'Funded', 'Completed', 'Released', 'Cancelled', 'Disputed', 'Resolved'] as const;

// ======================== CLIENTS ========================

function getPublicClient() {
  return createPublicClient({
    chain: ESCROW_CHAIN,
    transport: http(ESCROW_RPC_URL),
  });
}

function getRelayerWallet() {
  if (!RELAYER_KEY) throw new Error('ESCROW_RELAYER_PRIVATE_KEY not set');
  if (!ESCROW_CONTRACT) throw new Error(`ESCROW_CONTRACT_BASE${IS_TESTNET ? '_SEPOLIA' : ''} not set`);
  const account = privateKeyToAccount(RELAYER_KEY);
  return createWalletClient({
    account,
    chain: ESCROW_CHAIN,
    transport: http(ESCROW_RPC_URL),
  });
}

// ======================== HELPERS ========================

export function jobIdToHash(jobId: string): Hex {
  return keccak256(encodePacked(['string'], [jobId]));
}

function getContractAddress(): Hex {
  if (!ESCROW_CONTRACT) throw new Error(`ESCROW_CONTRACT_BASE${IS_TESTNET ? '_SEPOLIA' : ''} not set`);
  return ESCROW_CONTRACT;
}

// ======================== READ FUNCTIONS ========================

export async function getEscrowOnChain(jobIdHash: Hex) {
  const client = getPublicClient();
  const result = await client.readContract({
    address: getContractAddress(),
    abi: ESCROW_ABI,
    functionName: 'getEscrow',
    args: [jobIdHash],
  });
  return {
    depositor: result.depositor,
    payee: result.payee,
    arbitrator: result.arbitrator,
    amount: result.amount,
    arbitratorFeeBps: Number(result.arbitratorFeeBps),
    state: Number(result.state),
    stateName: EscrowStateNames[Number(result.state)],
    fundedAt: Number(result.fundedAt),
    completedAt: Number(result.completedAt),
    disputeWindow: Number(result.disputeWindow),
    disputedAt: Number(result.disputedAt),
  };
}

export async function getDisputeDeadline(jobIdHash: Hex): Promise<number> {
  const client = getPublicClient();
  const result = await client.readContract({
    address: getContractAddress(),
    abi: ESCROW_ABI,
    functionName: 'getDisputeDeadline',
    args: [jobIdHash],
  });
  return Number(result);
}

// ======================== WRITE FUNCTIONS (RELAYER) ========================

export async function markCompleteOnChain(jobIdHash: Hex): Promise<Hex> {
  const wallet = getRelayerWallet();
  const hash = await wallet.writeContract({
    address: getContractAddress(),
    abi: ESCROW_ABI,
    functionName: 'markComplete',
    args: [jobIdHash],
  });
  logger.info({ jobIdHash, txHash: hash }, 'markComplete tx sent');
  return hash;
}

export async function releaseOnChain(jobIdHash: Hex): Promise<Hex> {
  const wallet = getRelayerWallet();
  const hash = await wallet.writeContract({
    address: getContractAddress(),
    abi: ESCROW_ABI,
    functionName: 'release',
    args: [jobIdHash],
  });
  logger.info({ jobIdHash, txHash: hash }, 'release tx sent');
  return hash;
}

export async function forceReleaseOnChain(jobIdHash: Hex): Promise<Hex> {
  const wallet = getRelayerWallet();
  const hash = await wallet.writeContract({
    address: getContractAddress(),
    abi: ESCROW_ABI,
    functionName: 'forceRelease',
    args: [jobIdHash],
  });
  logger.info({ jobIdHash, txHash: hash }, 'forceRelease tx sent');
  return hash;
}

export async function resolveOnChain(
  jobIdHash: Hex,
  toPayee: bigint,
  toDepositor: bigint,
  arbitratorFee: bigint,
  nonce: bigint,
  signature: Hex,
): Promise<Hex> {
  const wallet = getRelayerWallet();
  const hash = await wallet.writeContract({
    address: getContractAddress(),
    abi: ESCROW_ABI,
    functionName: 'resolve',
    args: [jobIdHash, toPayee, toDepositor, arbitratorFee, nonce, signature],
  });
  logger.info({ jobIdHash, txHash: hash }, 'resolve tx sent');
  return hash;
}

export async function acceptCancelOnChain(jobIdHash: Hex): Promise<Hex> {
  const wallet = getRelayerWallet();
  const hash = await wallet.writeContract({
    address: getContractAddress(),
    abi: ESCROW_ABI,
    functionName: 'acceptCancel',
    args: [jobIdHash],
  });
  logger.info({ jobIdHash, txHash: hash }, 'acceptCancel tx sent');
  return hash;
}

// ======================== EVENT VERIFICATION ========================

export async function verifyDeposit(txHash: Hex, expectedJobIdHash: Hex) {
  const client = getPublicClient();
  const receipt = await client.getTransactionReceipt({ hash: txHash });

  if (receipt.status === 'reverted') {
    throw new Error('Transaction reverted');
  }

  // Find Deposited event
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== getContractAddress().toLowerCase()) continue;
    // Topic[0] = event signature for Deposited
    // Deposited(bytes32 indexed jobId, address indexed depositor, address indexed payee, uint256 amount, address arbitrator, uint256 arbitratorFeeBps, uint32 disputeWindow)
    if (log.topics[0] === keccak256(encodePacked(['string'], ['Deposited(bytes32,address,address,uint256,address,uint256,uint32)']))) {
      const jobIdFromEvent = log.topics[1];
      if (jobIdFromEvent?.toLowerCase() === expectedJobIdHash.toLowerCase()) {
        // Decode non-indexed params
        const decoded = decodeDepositedData(log.data as Hex);
        return {
          jobIdHash: jobIdFromEvent as Hex,
          depositor: log.topics[2] ? ('0x' + log.topics[2].slice(26)) as Hex : undefined,
          payee: log.topics[3] ? ('0x' + log.topics[3].slice(26)) as Hex : undefined,
          amount: decoded.amount,
          arbitrator: decoded.arbitrator,
          arbitratorFeeBps: decoded.arbitratorFeeBps,
          disputeWindow: decoded.disputeWindow,
          blockNumber: receipt.blockNumber,
        };
      }
    }
  }
  throw new Error('Deposited event not found for this jobId');
}

function decodeDepositedData(data: Hex) {
  const decoded = encodeAbiParameters // just for type ref
  // Manual decode: amount (uint256) + arbitrator (address) + arbitratorFeeBps (uint256) + disputeWindow (uint32)
  // Each slot is 32 bytes
  const amount = BigInt('0x' + data.slice(2, 66));
  const arbitrator = ('0x' + data.slice(90, 130)) as Hex;
  const arbitratorFeeBps = Number(BigInt('0x' + data.slice(130, 194)));
  const disputeWindow = Number(BigInt('0x' + data.slice(194, 258)));
  return { amount, arbitrator, arbitratorFeeBps, disputeWindow };
}

// ======================== CONFIG CHECK ========================

export function isEscrowEnabled(): boolean {
  return process.env.ESCROW_ENABLED === 'true' && !!ESCROW_CONTRACT;
}

export function getEscrowContractAddress(): string | undefined {
  return ESCROW_CONTRACT;
}
