import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  encodeFunctionData,
  type Account,
  type Chain,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet, base, polygon, arbitrum, baseSepolia } from 'viem/chains';
import * as readline from 'node:readline/promises';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { config } from './config.js';

// ── Network → chain + RPC mapping ──

interface NetworkConfig {
  chain: Chain;
  rpcs: string[];
}

const NETWORKS: Record<string, NetworkConfig> = {
  ethereum: {
    chain: mainnet,
    rpcs: ['https://eth.llamarpc.com', 'https://rpc.ankr.com/eth'],
  },
  base: {
    chain: base,
    rpcs: ['https://mainnet.base.org', 'https://base.llamarpc.com'],
  },
  polygon: {
    chain: polygon,
    rpcs: ['https://polygon-rpc.com', 'https://rpc.ankr.com/polygon'],
  },
  arbitrum: {
    chain: arbitrum,
    rpcs: ['https://arb1.arbitrum.io/rpc', 'https://arbitrum.llamarpc.com'],
  },
  'base-sepolia': {
    chain: baseSepolia,
    rpcs: ['https://sepolia.base.org'],
  },
};

// USDC contract addresses per network
const USDC_ADDRESSES: Record<string, `0x${string}`> = {
  ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
};

const USDC_DECIMALS = 6;

// Minimal ERC-20 ABI for transfer + balanceOf
const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

// ── Keystore path ──

const KEYSTORE_PATH = new URL('../keystore.json', import.meta.url).pathname;

// ── Wallet loading ──

/**
 * Check whether payment is configured (keystore file exists OR env var set).
 */
export function isPaymentConfigured(): boolean {
  return existsSync(KEYSTORE_PATH) || !!config.walletPrivateKey;
}

/**
 * Load the wallet account.
 * Priority: keystore.json (prompts for password) → WALLET_PRIVATE_KEY env var.
 */
export async function loadWalletAccount(): Promise<Account> {
  // Try keystore first
  if (existsSync(KEYSTORE_PATH)) {
    console.log('  Loading wallet from keystore.json...');
    const keystoreJson = await readFile(KEYSTORE_PATH, 'utf-8');
    const keystore = JSON.parse(keystoreJson);

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const password = await rl.question('  Enter keystore password: ');
    rl.close();

    // Dynamic import of ox (transitive dep of viem)
    const { Keystore } = await import('ox');
    const key = Keystore.toKey(keystore, { password });
    const privateKey = Keystore.decrypt(keystore, key) as `0x${string}`;
    return privateKeyToAccount(privateKey);
  }

  // Fall back to env var
  if (config.walletPrivateKey) {
    const key = config.walletPrivateKey.startsWith('0x')
      ? config.walletPrivateKey as `0x${string}`
      : `0x${config.walletPrivateKey}` as `0x${string}`;
    return privateKeyToAccount(key);
  }

  throw new Error('No wallet configured. Set WALLET_PRIVATE_KEY or run: npm run generate-keystore');
}

/**
 * Get USDC balance for the bot's wallet on the given network.
 */
export async function getUsdcBalance(
  account: Account,
  network: string,
): Promise<string> {
  const net = NETWORKS[network];
  if (!net) throw new Error(`Unsupported network: ${network}`);

  const usdcAddress = USDC_ADDRESSES[network];
  if (!usdcAddress) throw new Error(`No USDC address for network: ${network}`);

  const client = createPublicClient({
    chain: net.chain,
    transport: http(net.rpcs[0]),
  });

  const balance = await client.readContract({
    address: usdcAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [account.address],
  });

  return formatUnits(balance, USDC_DECIMALS);
}

/**
 * Send USDC to a recipient on the specified network.
 * Returns the confirmed transaction hash.
 */
export async function sendUsdc(
  account: Account,
  toAddress: string,
  amount: number,
  network: string,
): Promise<string> {
  const net = NETWORKS[network];
  if (!net) throw new Error(`Unsupported network: ${network}`);

  const usdcAddress = USDC_ADDRESSES[network];
  if (!usdcAddress) throw new Error(`No USDC address for network: ${network}`);

  const amountWei = parseUnits(amount.toString(), USDC_DECIMALS);

  const walletClient = createWalletClient({
    account,
    chain: net.chain,
    transport: http(net.rpcs[0]),
  });

  const publicClient = createPublicClient({
    chain: net.chain,
    transport: http(net.rpcs[0]),
  });

  // Encode the ERC-20 transfer call
  const data = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [toAddress as `0x${string}`, amountWei],
  });

  // Send the transaction
  const txHash = await walletClient.sendTransaction({
    to: usdcAddress,
    data,
  });

  console.log(`  Tx sent: ${txHash}`);
  console.log('  Waiting for confirmation...');

  // Wait for receipt
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 2,
  });

  if (receipt.status !== 'success') {
    throw new Error(`Transaction reverted: ${txHash}`);
  }

  return txHash;
}
