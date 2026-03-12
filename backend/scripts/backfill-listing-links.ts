/**
 * Backfill script: Generate 10 ListingLink short codes for every existing listing
 * that doesn't already have links.
 *
 * Safe to re-run: only targets listings with zero links.
 *
 * Usage: npx tsx backend/scripts/backfill-listing-links.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const LINK_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // 32 chars, no 0/o/1/l/i
const LINK_CODE_LENGTH = 6;

function generateLinkCode(): string {
  let code = '';
  for (let i = 0; i < LINK_CODE_LENGTH; i++) {
    code += LINK_ALPHABET[Math.floor(Math.random() * LINK_ALPHABET.length)];
  }
  return code;
}

const LABELS = [
  'default',
  'campaign-2', 'campaign-3', 'campaign-4', 'campaign-5',
  'campaign-6', 'campaign-7', 'campaign-8', 'campaign-9', 'campaign-10',
];

async function main() {
  // Find listings that have no links yet
  const listings = await prisma.listing.findMany({
    where: {
      links: { none: {} },
    },
    select: { id: true, title: true },
  });

  console.log(`Found ${listings.length} listings without short links.`);

  let created = 0;
  let failed = 0;
  const failures: { listingId: string; label: string; error: string }[] = [];

  for (const listing of listings) {
    let listingCreated = 0;
    for (const label of LABELS) {
      let attempts = 0;
      while (attempts < 5) {
        try {
          await prisma.listingLink.create({
            data: {
              code: generateLinkCode(),
              listingId: listing.id,
              label,
            },
          });
          created++;
          listingCreated++;
          break;
        } catch (err: any) {
          if (err?.code === 'P2002') {
            // Unique constraint collision — retry with a new code
            attempts++;
            continue;
          }
          // Non-collision error — log and continue to next label
          console.error(`  ✗ Failed to create "${label}" for ${listing.id}: ${err.message}`);
          failures.push({ listingId: listing.id, label, error: err.message });
          failed++;
          break;
        }
      }
      if (attempts >= 5) {
        console.error(`  ✗ Max retries for "${label}" on ${listing.id} (code collision)`);
        failures.push({ listingId: listing.id, label, error: '5 consecutive code collisions' });
        failed++;
      }
    }
    console.log(`  ✓ ${listing.title} (${listing.id}) — ${listingCreated}/10 links created`);
  }

  console.log(`\nDone. Created ${created} links for ${listings.length} listings.`);
  if (failures.length > 0) {
    console.error(`\n⚠ ${failed} links failed to create:`);
    for (const f of failures) {
      console.error(`  - ${f.listingId} / ${f.label}: ${f.error}`);
    }
    process.exitCode = 1;
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
