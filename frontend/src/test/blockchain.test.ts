import { describe, it, expect } from 'vitest';
import { getExplorerTxUrl } from '../lib/blockchain';

const TX_HASH = '0xabc123def456789012345678901234567890123456789012345678901234abcd';

describe('getExplorerTxUrl', () => {
  it('returns Etherscan URL for ethereum network', () => {
    expect(getExplorerTxUrl('ethereum', TX_HASH)).toBe(`https://etherscan.io/tx/${TX_HASH}`);
  });

  it('returns Basescan URL for base network', () => {
    expect(getExplorerTxUrl('base', TX_HASH)).toBe(`https://basescan.org/tx/${TX_HASH}`);
  });

  it('returns Polygonscan URL for polygon network', () => {
    expect(getExplorerTxUrl('polygon', TX_HASH)).toBe(`https://polygonscan.com/tx/${TX_HASH}`);
  });

  it('returns Arbiscan URL for arbitrum network', () => {
    expect(getExplorerTxUrl('arbitrum', TX_HASH)).toBe(`https://arbiscan.io/tx/${TX_HASH}`);
  });

  it('returns Sepolia Basescan URL for base-sepolia network', () => {
    expect(getExplorerTxUrl('base-sepolia', TX_HASH)).toBe(`https://sepolia.basescan.org/tx/${TX_HASH}`);
  });

  it('is case-insensitive for network name', () => {
    expect(getExplorerTxUrl('Ethereum', TX_HASH)).toBe(`https://etherscan.io/tx/${TX_HASH}`);
    expect(getExplorerTxUrl('BASE', TX_HASH)).toBe(`https://basescan.org/tx/${TX_HASH}`);
  });

  it('returns null for unsupported network', () => {
    expect(getExplorerTxUrl('solana', TX_HASH)).toBeNull();
    expect(getExplorerTxUrl('', TX_HASH)).toBeNull();
  });
});
