/**
 * Shared wallet address extraction from Privy state.
 *
 * IMPORTANT: This function is the ONLY shared layer between onboarding and
 * dashboard wallet flows. Do NOT merge the post-extraction logic — onboarding
 * is fire-and-forget (grab address, persist, logout), while the dashboard does
 * signature verification, embedded wallet creation, mobile opt-in, export, etc.
 * These are intentionally separate flows.
 */

interface PrivyWalletLike {
  address: string;
  walletClientType?: string;
}

interface PrivyUserLike {
  linkedAccounts?: Array<{ type: string; address?: string; [key: string]: any }>;
}

interface ExtractedWallet {
  /** The wallet address, or null if none found */
  address: string | null;
  /** Whether this is a Privy-managed embedded wallet */
  isEmbedded: boolean;
}

/**
 * Extract the best wallet address from Privy state.
 *
 * Priority: Privy embedded wallet → first external wallet → linked account fallback.
 *
 * Handles only EVM-compatible wallets (0x-prefixed, 40 hex chars).
 * Returns { address: null } for unrecognized shapes — never silently
 * returns a wrong or non-EVM address.
 */
export function extractWalletAddress(
  privyWallets: PrivyWalletLike[],
  privyUser: PrivyUserLike | null | undefined,
): ExtractedWallet {
  // Prefer Privy embedded wallet, then fall back to first available
  const privyEmbedded = privyWallets.find((w) => w.walletClientType === 'privy');
  const firstWallet = privyWallets[0];
  const chosen = privyEmbedded || firstWallet;

  if (chosen?.address) {
    return {
      address: chosen.address,
      isEmbedded: chosen.walletClientType === 'privy',
    };
  }

  // Fall back to linked accounts (covers edge cases where useWallets()
  // hasn't populated yet but the user object already has the wallet)
  if (privyUser?.linkedAccounts) {
    const linked = privyUser.linkedAccounts.find((a) => a.type === 'wallet');
    if (linked?.address) {
      return { address: linked.address, isEmbedded: true };
    }
  }

  return { address: null, isEmbedded: false };
}
