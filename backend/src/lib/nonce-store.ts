import crypto from 'crypto';

interface NonceEntry {
  nonce: string;
  expiresAt: number;
}

const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SWEEP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

class NonceStore {
  private store = new Map<string, NonceEntry>();
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.sweepTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    // Allow the process to exit without waiting for the timer
    if (this.sweepTimer.unref) this.sweepTimer.unref();
  }

  private key(userId: string, address: string): string {
    return `${userId}:${address.toLowerCase()}`;
  }

  generate(userId: string, address: string): string {
    const nonce = crypto.randomBytes(32).toString('hex');
    this.store.set(this.key(userId, address), {
      nonce,
      expiresAt: Date.now() + NONCE_TTL_MS,
    });
    return nonce;
  }

  verify(userId: string, address: string, nonce: string): boolean {
    const k = this.key(userId, address);
    const entry = this.store.get(k);
    if (!entry) return false;
    // Delete immediately (single-use)
    this.store.delete(k);
    if (Date.now() > entry.expiresAt) return false;
    return entry.nonce === nonce;
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  /** Visible for testing */
  _clear(): void {
    this.store.clear();
  }
}

export const nonceStore = new NonceStore();
