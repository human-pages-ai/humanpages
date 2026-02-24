/**
 * One-off script: Rewrite all DRAFT and APPROVED ContentItems with humanizer rules.
 *
 * Uses Claude via Agent SDK to regenerate tweet, LinkedIn, and blog text
 * while preserving the source metadata, slugs, and status.
 *
 * Usage:
 *   cd /home/ubuntu/projects/human-pages/backend
 *   npx tsx scripts/rewrite-content-humanized.ts
 *   npx tsx scripts/rewrite-content-humanized.ts --dry-run   # preview without saving
 */

import { PrismaClient } from "@prisma/client";
import { query } from "@anthropic-ai/claude-agent-sdk";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

const HUMANIZER_RULES = `
ANTI-AI WRITING RULES (mandatory):
- BANNED words/phrases: testament, landscape (abstract), pivotal, crucial, delve, foster, garner, underscore, showcase, tapestry (abstract), vibrant, nestled, groundbreaking, breathtaking, interplay, intricate, additionally, enhance, enduring, valuable, renowned, profound, exemplifies, commitment to, in the heart of, indelible mark, deeply rooted, setting the stage, marking/shaping the, evolving landscape, focal point
- BANNED constructions: "serves as" / "stands as" / "marks a" — just use "is". "Not only X but Y" / "It's not just X, it's Y". "From X to Y, from A to B" (false ranges).
- NO superficial -ing tack-ons: "highlighting...", "emphasizing...", "reflecting...", "contributing to...", "showcasing...", "ensuring...", "fostering..."
- NO vague attribution: "experts say", "observers note", "industry reports suggest"
- NO filler: "In order to", "It is important to note", "At its core", "Due to the fact that", "has the ability to"
- NO hedge piles: "could potentially possibly might"
- NO chatbot artifacts: "I hope this helps", "Let me know if", "Great question!", "Certainly!", "Here is a"
- NO generic conclusions: "The future looks bright", "exciting times ahead", "journey toward excellence"
- NO em dash overuse — use commas or periods instead
- NO rule-of-three for fake comprehensiveness ("X, Y, and Z" to sound thorough)
- NO synonym cycling (calling the same thing "protagonist", "main character", "central figure", "hero")
- NO emoji decorators on headings or bullets
- NO bolded inline headers in lists ("**Speed:** ...")
- Vary sentence length — short punchy ones, then longer ones. Mix it up.
- Have opinions. Be specific. Use concrete examples and numbers.
- Sound like a person with a point of view, not a press release or Wikipedia article.
`.trim();

function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k !== "CLAUDECODE" && v !== undefined) env[k] = v;
  }
  return env;
}

async function callClaude(prompt: string): Promise<string> {
  const conversation = query({
    prompt,
    options: {
      maxTurns: 1,
      tools: [],
      model: "claude-sonnet-4-6",
      env: cleanEnv(),
      thinking: { type: "disabled" },
      persistSession: false,
    },
  });

  for await (const msg of conversation) {
    if (msg.type === "result" && msg.subtype === "success") {
      return msg.result;
    }
    if (msg.type === "result" && msg.subtype !== "success") {
      const errorMsg = "errors" in msg ? (msg.errors as string[]).join("; ") : msg.subtype;
      throw new Error(`Claude error: ${errorMsg}`);
    }
  }
  throw new Error("No result from Claude");
}

function extractJSON(text: string): any {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    const lines = cleaned.split("\n");
    cleaned = lines.filter((l) => !l.trim().startsWith("```")).join("\n");
  }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  throw new Error("No JSON found in response");
}

async function rewriteTweet(item: { sourceTitle: string; tweetDraft: string }): Promise<string> {
  const prompt = `You are the voice of Human Pages (@HumanPagesAI).

Human Pages: AI agents hire humans for tasks. Agents post jobs, humans complete them, payment in USDC.

Brand voice: Dry, confident, slightly dystopian. Write like a founder in the trenches, not a content marketer.

Rewrite this tweet draft to sound more human and authentic. Keep the same topic and angle, but improve the writing.

Original tweet:
${item.tweetDraft}

Topic: ${item.sourceTitle}

${HUMANIZER_RULES}

Generate EXACTLY this JSON:
{ "x_draft": "Rewritten tweet, max 240 chars. No hashtags." }

Return ONLY the JSON.`;

  const resp = await callClaude(prompt);
  const parsed = extractJSON(resp);
  return parsed.x_draft || item.tweetDraft;
}

async function rewriteLinkedIn(item: { sourceTitle: string; linkedinSnippet: string; blogSlug: string | null }): Promise<string> {
  const prompt = `You are the voice of Human Pages (@HumanPagesAI).

Human Pages: AI agents hire humans for tasks. Agents post jobs, humans complete them, payment in USDC.

Brand voice: Dry, confident, slightly dystopian. Write like a founder in the trenches, not a content marketer.

Rewrite this LinkedIn snippet to sound more human and authentic. Keep the same topic and angle, but improve the writing.${item.blogSlug ? ` End with: Read more: humanpages.ai/blog/${item.blogSlug}` : ""}

Original snippet:
${item.linkedinSnippet}

Topic: ${item.sourceTitle}

${HUMANIZER_RULES}

Generate EXACTLY this JSON:
{ "linkedin_snippet": "Rewritten 2-3 sentence snippet." }

Return ONLY the JSON.`;

  const resp = await callClaude(prompt);
  const parsed = extractJSON(resp);
  return parsed.linkedin_snippet || item.linkedinSnippet;
}

async function rewriteBlog(item: { sourceTitle: string; blogTitle: string; blogBody: string; blogSlug: string }): Promise<{ blogTitle: string; blogBody: string; blogExcerpt: string; blogReadingTime: string }> {
  const prompt = `You are the voice of Human Pages (@HumanPagesAI).

Human Pages: AI agents hire humans for tasks. Agents post jobs, humans complete them, payment in USDC.

Brand voice: Dry, confident, slightly dystopian. Write like a founder in the trenches, not a content marketer. Never start with "In today's rapidly evolving..." or any generic opener. Use specific data, real scenarios, deadpan humor.

Rewrite this blog article to sound more human and authentic. Keep the same structure, topic, and key points, but make the writing sharper.

Original title: ${item.blogTitle}
Original article:
${item.blogBody}

Requirements:
- 800-1200 words, markdown format
- Specific opening line that hooks immediately (no bold/italic formatting on the opener)
- Subheadings (##) every 200-300 words
- At least one concrete Human Pages scenario
- End with a thought-provoking conclusion, not a sales pitch
- Never start a paragraph with bold text. Use bold sparingly and only mid-sentence for emphasis.

${HUMANIZER_RULES}

Generate EXACTLY this JSON:
{
  "blog_title": "Rewritten headline",
  "blog_body": "Full rewritten markdown article...",
  "blog_excerpt": "160 char meta description for SEO",
  "blog_reading_time": "X min"
}

Return ONLY the JSON.`;

  const resp = await callClaude(prompt);
  const parsed = extractJSON(resp);
  return {
    blogTitle: parsed.blog_title || item.blogTitle,
    blogBody: parsed.blog_body || item.blogBody,
    blogExcerpt: parsed.blog_excerpt || "",
    blogReadingTime: parsed.blog_reading_time || "",
  };
}

async function main() {
  console.log(`=== Content Rewrite with Humanizer ${DRY_RUN ? "(DRY RUN)" : ""} ===\n`);

  const items = await prisma.contentItem.findMany({
    where: { status: { in: ["DRAFT", "APPROVED"] } },
    orderBy: { createdAt: "desc" },
  });

  console.log(`Found ${items.length} items (DRAFT + APPROVED) to rewrite\n`);

  if (items.length === 0) {
    console.log("Nothing to rewrite.");
    return;
  }

  let success = 0;
  let failed = 0;

  for (const item of items) {
    const label = `[${item.platform}] "${item.sourceTitle.slice(0, 50)}" (${item.id})`;
    console.log(`Processing ${label}...`);

    try {
      const updateData: Record<string, any> = {};

      if (item.platform === "TWITTER" && item.tweetDraft) {
        const newTweet = await rewriteTweet({
          sourceTitle: item.sourceTitle,
          tweetDraft: item.tweetDraft,
        });
        updateData.tweetDraft = newTweet;
        console.log(`  Tweet: "${newTweet.slice(0, 80)}..."`);
      }

      if (item.platform === "LINKEDIN" && item.linkedinSnippet) {
        const newSnippet = await rewriteLinkedIn({
          sourceTitle: item.sourceTitle,
          linkedinSnippet: item.linkedinSnippet,
          blogSlug: item.blogSlug,
        });
        updateData.linkedinSnippet = newSnippet;
        console.log(`  LinkedIn: "${newSnippet.slice(0, 80)}..."`);
      }

      if (item.platform === "BLOG" && item.blogBody && item.blogTitle && item.blogSlug) {
        const newBlog = await rewriteBlog({
          sourceTitle: item.sourceTitle,
          blogTitle: item.blogTitle,
          blogBody: item.blogBody,
          blogSlug: item.blogSlug,
        });
        updateData.blogTitle = newBlog.blogTitle;
        updateData.blogBody = newBlog.blogBody;
        updateData.blogExcerpt = newBlog.blogExcerpt;
        updateData.blogReadingTime = newBlog.blogReadingTime;
        updateData.metaDescription = newBlog.blogExcerpt.slice(0, 300);
        console.log(`  Blog: "${newBlog.blogTitle}"`);
      }

      if (Object.keys(updateData).length > 0 && !DRY_RUN) {
        await prisma.contentItem.update({
          where: { id: item.id },
          data: updateData,
        });
        console.log(`  Saved.\n`);
      } else if (DRY_RUN) {
        console.log(`  [dry-run] Would update ${Object.keys(updateData).length} fields\n`);
      }

      success++;
    } catch (e) {
      console.log(`  FAILED: ${e}\n`);
      failed++;
    }
  }

  console.log(`\n=== Done: ${success} rewritten, ${failed} failed ===`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
