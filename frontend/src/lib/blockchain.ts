const EXPLORER_URLS: Record<string, string> = {
  ethereum: 'https://etherscan.io/tx/',
  base: 'https://basescan.org/tx/',
  polygon: 'https://polygonscan.com/tx/',
  arbitrum: 'https://arbiscan.io/tx/',
  'base-sepolia': 'https://sepolia.basescan.org/tx/',
};

export function getExplorerTxUrl(network: string, txHash: string): string | null {
  const base = EXPLORER_URLS[network.toLowerCase()];
  if (!base) return null;
  return `${base}${txHash}`;
}
