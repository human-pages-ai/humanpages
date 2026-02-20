/**
 * Seed posting data (AdCopy + PostingGroup) into the database.
 * Run from repo root: cd backend && node ../scripts/seed-posting-data.mjs
 * Or on production:   cd /opt/human-pages/backend && node ../scripts/seed-posting-data.mjs
 *
 * Safe to run multiple times — uses upsert to avoid duplicates.
 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve Prisma from the backend directory (where it's generated)
const backendDir = join(__dirname, '..', 'backend');
const { PrismaClient } = require(join(backendDir, 'node_modules', '@prisma', 'client'));

const prisma = new PrismaClient();

async function main() {
  const dataPath = join(__dirname, 'posting-seed-data.json');
  const { ads, groups } = JSON.parse(readFileSync(dataPath, 'utf8'));

  console.log(`Seeding ${ads.length} AdCopy rows and ${groups.length} PostingGroup rows...`);

  // Upsert AdCopy first (PostingGroup references them)
  let adCreated = 0;
  for (const ad of ads) {
    await prisma.adCopy.upsert({
      where: { id: ad.id },
      create: {
        id: ad.id,
        adNumber: ad.adNumber,
        language: ad.language,
        title: ad.title,
        body: ad.body,
        createdAt: new Date(ad.createdAt),
        updatedAt: new Date(ad.updatedAt),
      },
      update: {}, // no-op if exists
    });
    adCreated++;
  }
  console.log(`  AdCopy: ${adCreated} upserted`);

  // Upsert PostingGroup in batches
  let groupCreated = 0;
  for (const g of groups) {
    await prisma.postingGroup.upsert({
      where: { id: g.id },
      create: {
        id: g.id,
        name: g.name,
        url: g.url,
        adId: g.adId,
        language: g.language,
        country: g.country,
        status: g.status,
        taskType: g.taskType,
        campaign: g.campaign,
        notes: g.notes,
        createdAt: new Date(g.createdAt),
        updatedAt: new Date(g.updatedAt),
      },
      update: {}, // no-op if exists
    });
    groupCreated++;
    if (groupCreated % 100 === 0) console.log(`  PostingGroup: ${groupCreated}/${groups.length}...`);
  }
  console.log(`  PostingGroup: ${groupCreated} upserted`);
  console.log('Done!');
}

main()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
