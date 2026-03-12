/**
 * Backfill script: Generate 10 ListingLink short codes for every existing listing
 * that doesn't already have links.
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
  for (const listing of listings) {
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
          break;
        } catch (err: any) {
          if (err?.code === 'P2002') {
            attempts++;
            continue;
          }
          throw err;
        }
      }
    }
    console.log(`  ✓ ${listing.title} (${listing.id}) — 10 links created`);
  }

  console.log(`\nDone. Created ${created} links for ${listings.length} listings.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
