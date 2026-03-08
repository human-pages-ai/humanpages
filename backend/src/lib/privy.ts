import { PrivyClient, type User as PrivyUser, type LinkedAccount } from '@privy-io/node';
import { logger } from './logger.js';

let _client: PrivyClient | null = null;

/**
 * Lazily initialise the Privy server client.
 * Requires PRIVY_APP_ID and PRIVY_APP_SECRET in process.env (loaded via Infisical in prod, .env in dev).
 */
export function getPrivyClient(): PrivyClient {
  if (_client) return _client;

  const appId = process.env.PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error('PRIVY_APP_ID and PRIVY_APP_SECRET must be set');
  }

  _client = new PrivyClient({ appId, appSecret });
  return _client;
}

/**
 * Extract all embedded wallet addresses owned by a Privy user.
 * Embedded wallets have `wallet_client === 'privy'` and `connector_type === 'embedded'`.
 */
export function getEmbeddedWalletAddresses(user: PrivyUser): string[] {
  return user.linked_accounts
    .filter(
      (a: LinkedAccount) =>
        a.type === 'wallet' &&
        'wallet_client' in a &&
        a.wallet_client === 'privy' &&
        'connector_type' in a &&
        a.connector_type === 'embedded'
    )
    .map((a) => ('address' in a ? (a.address as string).toLowerCase() : ''))
    .filter(Boolean);
}

/**
 * Verify a Privy identity token and return the parsed user.
 * Uses the PrivyUsersService.get() which verifies the JWT and parses linked_accounts.
 */
export async function verifyIdentityToken(idToken: string): Promise<PrivyUser> {
  const client = getPrivyClient();
  return client.users().get({ id_token: idToken });
}

/**
 * REST fallback: fetch a Privy user by their DID (e.g. when identity token is stale).
 */
export async function getPrivyUserByDid(did: string): Promise<PrivyUser> {
  const client = getPrivyClient();
  return client.users()._get(did);
}

export type { PrivyUser };
