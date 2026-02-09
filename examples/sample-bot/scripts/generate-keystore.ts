#!/usr/bin/env npx tsx
/**
 * generate-keystore.ts — Encrypt a private key into keystore.json
 *
 * Usage:
 *   npx tsx scripts/generate-keystore.ts
 *
 * The script prompts for your private key and a password, then writes
 * an encrypted keystore.json to the project root.  At runtime the bot
 * will ask for the password to decrypt it — your key never touches disk
 * in plaintext.
 */

import * as readline from 'node:readline/promises';
import { writeFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEYSTORE_PATH = resolve(__dirname, '..', 'keystore.json');

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n=== Keystore Generator ===');
  console.log('Encrypts your private key so it never sits on disk in plaintext.\n');

  // Check if keystore already exists
  try {
    await access(KEYSTORE_PATH, constants.F_OK);
    const overwrite = await rl.question('keystore.json already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Aborted.');
      rl.close();
      return;
    }
  } catch {
    // File doesn't exist — good
  }

  const privateKey = await rl.question('Private key (0x...): ');
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    console.error('Invalid private key. Must be 0x followed by 64 hex characters.');
    rl.close();
    process.exit(1);
  }

  const password = await rl.question('Encryption password: ');
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    rl.close();
    process.exit(1);
  }

  const confirmPassword = await rl.question('Confirm password: ');
  if (password !== confirmPassword) {
    console.error('Passwords do not match.');
    rl.close();
    process.exit(1);
  }

  rl.close();

  console.log('\nEncrypting (this may take a few seconds)...');

  const { Keystore } = await import('ox');
  const [key, opts] = await Keystore.pbkdf2Async({ password });
  const keystore = Keystore.encrypt(privateKey as `0x${string}`, key, opts);

  await writeFile(KEYSTORE_PATH, JSON.stringify(keystore, null, 2) + '\n');

  console.log(`\nKeystore written to: ${KEYSTORE_PATH}`);
  console.log('\nNext steps:');
  console.log('  1. Add keystore.json to .gitignore (already there by default)');
  console.log('  2. Remove WALLET_PRIVATE_KEY from .env (no longer needed)');
  console.log('  3. Run the bot — it will prompt for your password at startup');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
