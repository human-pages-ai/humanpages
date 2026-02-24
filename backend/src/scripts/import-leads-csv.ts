/**
 * One-time CSV import script for influencer leads.
 * Reads all CSV files in marketing/influencers/ and imports them into InfluencerLead table.
 *
 * Usage: npx tsx src/scripts/import-leads-csv.ts
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient, LeadSource } from '@prisma/client';

const prisma = new PrismaClient();

// Resolve relative to the backend directory (parent of src/)
const CSV_DIR = path.resolve(process.cwd(), '../marketing/influencers');

// Map filename to list name
const FILE_TO_LIST: Record<string, string> = {
  'ai-agents-futureofwork-influencers.csv': 'ai-agents-futureofwork',
  'ai-news-influencers.csv': 'ai-news',
  'career-coach-influencers.csv': 'career-coach',
  'crypto-ai-agents-influencers.csv': 'crypto-ai-agents',
  'crypto-ethereum-influencers.csv': 'crypto-ethereum',
  'crypto-general-influencers.csv': 'crypto-general',
  'crypto-media-influencers.csv': 'crypto-media',
  'gig-economy-influencers.csv': 'gig-economy',
  'hr-influencers.csv': 'hr',
  'stack-partners-outreach.csv': 'stack-partners',
  'target-market-influencers.csv': 'target-market',
  'tech-influencers.csv': 'tech',
};

/**
 * Parse a CSV line respecting quoted fields with commas inside.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

function parsePlatforms(raw: string): string[] {
  if (!raw) return [];
  // Split on " / ", "/", ",", " and " etc.
  return raw.split(/\s*[\/,]\s*|\s+and\s+/i).map(s => s.trim()).filter(Boolean);
}

function generateDedupeKey(name: string, list: string): string {
  const clean = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${clean}::${list}`;
}

interface LeadData {
  name: string;
  platforms: string[];
  handle?: string;
  followers?: string;
  email?: string;
  phone?: string;
  contactUrl?: string;
  focusAreas?: string;
  whyRelevant?: string;
  notes?: string;
  list: string;
  country?: string;
  language?: string;
  dedupeKey: string;
  source: LeadSource;
  sourceDetail?: string;
  sourceUrl?: string;
  outreachMessage?: string;
}

function parseFile(filename: string, listName: string): LeadData[] {
  const filepath = path.join(CSV_DIR, filename);
  const content = fs.readFileSync(filepath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers = parseCsvLine(headerLine).map(h => h.toLowerCase().trim());

  // Build column index map
  const colIndex: Record<string, number> = {};
  headers.forEach((h, i) => { colIndex[h] = i; });

  // Determine column positions by header names
  const nameIdx = colIndex['name'] ?? -1;
  const platformIdx = colIndex['platform(s)'] ?? -1;
  const handleIdx = colIndex['handle'] ?? -1;
  const followersIdx = colIndex['followers/subscribers'] ?? -1;
  const emailIdx = colIndex['email'] ?? -1;
  const phoneIdx = colIndex['phone'] ?? -1;
  const contactIdx = colIndex['contact form / website'] ?? -1;
  const focusIdx = colIndex['focus areas'] ?? -1;
  const whyIdx = colIndex['why relevant'] ?? -1;
  const notesIdx = colIndex['notes'] ?? -1;
  const sourceIdx = colIndex['source'] ?? -1;
  const sourceUrlIdx = colIndex['source url'] ?? -1;
  const dedupeIdx = colIndex['dedupekey'] ?? -1;
  const countryIdx = colIndex['country/market'] ?? -1;
  const languageIdx = colIndex['language'] ?? -1;
  const howWeUseIdx = colIndex['how we use them'] ?? -1;
  const outreachAngleIdx = colIndex['outreach angle'] ?? -1;

  const leads: LeadData[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    if (fields.length < 3) continue;

    const get = (idx: number) => idx >= 0 && idx < fields.length ? fields[idx] || undefined : undefined;

    const name = get(nameIdx);
    if (!name) continue;

    // Build notes by combining various fields
    const noteParts: string[] = [];
    const rawNotes = get(notesIdx);
    if (rawNotes) noteParts.push(rawNotes);
    if (howWeUseIdx >= 0) {
      const howWeUse = get(howWeUseIdx);
      if (howWeUse) noteParts.push(`How we use them: ${howWeUse}`);
    }
    if (outreachAngleIdx >= 0) {
      const outreachAngle = get(outreachAngleIdx);
      if (outreachAngle) noteParts.push(`Outreach angle: ${outreachAngle}`);
    }

    const rawDedupe = get(dedupeIdx);
    const dedupeKey = rawDedupe || generateDedupeKey(name, listName);

    const lead: LeadData = {
      name,
      platforms: parsePlatforms(get(platformIdx) || ''),
      handle: get(handleIdx),
      followers: get(followersIdx),
      email: get(emailIdx),
      phone: get(phoneIdx),
      contactUrl: get(contactIdx),
      focusAreas: get(focusIdx),
      whyRelevant: get(whyIdx),
      notes: noteParts.join(' | ') || undefined,
      list: listName,
      country: get(countryIdx),
      language: get(languageIdx),
      dedupeKey,
      source: LeadSource.CSV_IMPORT,
      sourceDetail: get(sourceIdx),
      sourceUrl: get(sourceUrlIdx),
    };

    leads.push(lead);
  }

  return leads;
}

async function main() {
  console.log(`Reading CSVs from: ${CSV_DIR}`);
  console.log('');

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const [filename, listName] of Object.entries(FILE_TO_LIST)) {
    const filepath = path.join(CSV_DIR, filename);
    if (!fs.existsSync(filepath)) {
      console.log(`  SKIP ${filename} (not found)`);
      continue;
    }

    const leads = parseFile(filename, listName);

    // Check existing dedupeKeys
    const keys = leads.map(l => l.dedupeKey);
    const existing = await prisma.influencerLead.findMany({
      where: { dedupeKey: { in: keys } },
      select: { dedupeKey: true },
    });
    const existingKeys = new Set(existing.map(e => e.dedupeKey));

    let created = 0;
    let skipped = 0;

    for (const lead of leads) {
      if (existingKeys.has(lead.dedupeKey)) {
        skipped++;
        continue;
      }

      await prisma.influencerLead.create({
        data: {
          name: lead.name,
          platforms: lead.platforms,
          handle: lead.handle || null,
          followers: lead.followers || null,
          email: lead.email || null,
          phone: lead.phone || null,
          contactUrl: lead.contactUrl || null,
          focusAreas: lead.focusAreas || null,
          whyRelevant: lead.whyRelevant || null,
          notes: lead.notes || null,
          list: lead.list,
          country: lead.country || null,
          language: lead.language || null,
          dedupeKey: lead.dedupeKey,
          source: lead.source,
          sourceDetail: lead.sourceDetail || null,
          sourceUrl: lead.sourceUrl || null,
        },
      });
      created++;
    }

    console.log(`  ${filename}: ${created} created, ${skipped} skipped (${leads.length} total rows)`);
    totalCreated += created;
    totalSkipped += skipped;
  }

  console.log('');
  console.log(`Done. Created: ${totalCreated}, Skipped: ${totalSkipped}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
