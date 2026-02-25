# GEO (Generative Engine Optimization) Action Items

**Created:** 2026-02-25
**Goal:** Increase Human Pages' visibility in LLM-generated answers and agent tool discovery.

---

## Current State

### Already Done
- **llms.txt** — comprehensive 130-line guide at `/llms.txt`
- **MCP server** — 16 tools, installable via `npx humanpages` (strongest asset)
- **OpenAPI spec** — full 3.1.0 spec at `/.well-known/openapi.json`
- **ai-plugin.json** — ChatGPT plugin manifest at `/.well-known/ai-plugin.json`
- **schema.org markup** — Organization, WebSite, FAQPage, BreadcrumbList, SoftwareApplication, Person, Blog, Article, HowTo
- **robots.txt** — AI crawler allowlist (GPTBot, ClaudeBot, PerplexityBot, etc.)
- **11 blog articles** — dev tutorials, guides, how-tos with structured data
- **Content automation pipelines** — reply-engine, blog-engine, youtube-outreach, video-pipeline

### What's Missing
The items below are prioritized by expected impact on LLM recommendations.

---

## P0 — Third-Party Mentions (Biggest Lever)

LLMs form recommendations from training data. If Human Pages isn't mentioned in comparison articles, listicles, and community discussions, no LLM will recommend it.

### Action Items

- [ ] **Write/commission 3-5 comparison articles** — "Top AI-native hiring platforms", "Best APIs for AI agents to hire humans", "Fiverr vs Upwork vs Human Pages for AI agents". Publish on Medium, dev.to, or as guest posts on relevant blogs.
- [ ] **Seed organic Reddit threads** — Post in r/artificial, r/MachineLearning, r/SideProject, r/webdev, r/cryptocurrency with genuine context (launch stories, "how I built this" posts, comparison discussions). Don't shill — contribute to real conversations.
- [ ] **Launch on Hacker News** — "Show HN: Human Pages — AI agents hire real humans for physical tasks". Time it for US morning (9-10am ET, weekday). Have 5+ accounts ready to engage in comments authentically.
- [ ] **Product Hunt launch** — Prepare assets (logo, screenshots, tagline, maker comment). PH gets heavily indexed by LLMs. Coordinate upvotes from community.
- [ ] **Pitch guest posts to AI/dev blogs** — Target: The New Stack, Towards Data Science, Hacker Noon, Smashing Magazine, LogRocket Blog. Angle: "How we built an API-first marketplace for AI agents".

---

## P1 — Entity Establishment

LLMs need to recognize "Human Pages" as a distinct, real entity in the hiring/AI agent space.

### Action Items

- [ ] **Create Crunchbase profile** — Company name, description, founding date, founders, category (AI, Marketplace, Crypto). Free to create. Heavily indexed.
- [ ] **Create/update LinkedIn company page** — Consistent naming ("Human Pages"), description matching other profiles. Post weekly updates.
- [ ] **Create Wikidata entry** — Doesn't require notability like Wikipedia. Add: instance of "web application", "marketplace", industry "artificial intelligence". Link to official site.
- [ ] **Wikipedia page** (stretch goal) — Requires third-party reliable sources. Defer until after press coverage or notable traction. Don't attempt without sufficient independent sourcing.
- [ ] **Consistent entity description everywhere** — Standardize the one-liner across all platforms: "Human Pages is an AI-to-human marketplace where AI agents discover and hire verified humans for real-world tasks, with zero platform fees and direct USDC payments."

---

## P2 — Directory & Aggregator Listings

These platforms are heavily represented in LLM training data.

### Action Items

- [ ] **Product Hunt** — (overlaps with P0, but also a directory). Create a proper product page with all metadata.
- [ ] **AlternativeTo** — List as alternative to Fiverr, Upwork, Mechanical Turk. Add tags: AI, marketplace, freelancing, crypto payments.
- [ ] **G2** — Create a vendor profile. Even with zero reviews initially, the listing gets indexed.
- [ ] **StackShare** — List the tech stack and the product. Developers browse this when evaluating tools.
- [ ] **Submit to llmstxt.directory** and **directory.llmstxt.cloud** — Both index sites with llms.txt files. Easy wins.
- [ ] **GitHub awesome-lists** — Submit PRs to: awesome-ai-agents, awesome-web3, awesome-crypto, awesome-hiring, awesome-mcp-servers, awesome-api. Each PR = a backlink in a high-traffic repo.
- [ ] **MCP directories** — Submit to mcp.run, glama.ai/mcp, smithery.ai, and any emerging MCP tool directories.

---

## P3 — Developer Content on External Platforms

LLMs over-index on developer-facing content. The blog articles exist on humanpages.ai but external platforms carry more weight.

### Action Items

- [ ] **Dev.to series** — "Building an AI Agent That Hires Humans" (3-5 parts). Cover: architecture, MCP integration, payment flow, trust model.
- [ ] **Hashnode tutorial** — "How to Integrate Human Pages MCP Server with Claude" — step-by-step with code snippets.
- [ ] **npm README enrichment** — Ensure the `humanpages` npm package README is comprehensive: badges, usage examples, feature list, comparison table. npm READMEs get crawled heavily.
- [ ] **GitHub repo README** — If the MCP server repo is public, add detailed README with architecture diagram, quick-start, and use cases.
- [ ] **YouTube tutorial** — "Build an AI Agent That Hires Real Humans in 10 Minutes" — screencast showing MCP setup → search → hire flow.

---

## P4 — Structured Data Enhancements

Most schema.org types are already implemented. A few additions:

### Action Items

- [ ] **Add `WebApplication` type to landing page** — Currently only on DevelopersPage. The landing page should also declare Human Pages as a WebApplication with `applicationCategory: "BusinessApplication"`, `operatingSystem: "Web"`, `offers` (free tier).
- [ ] **Add `Service` type** — Declare the API as a schema.org Service with `serviceType: "AI Agent Marketplace"`, `provider`, `areaServed: "Worldwide"`.
- [ ] **Add `HowTo` structured data to onboarding blog post** — The "Set up your profile in 5 minutes" article is a natural fit.
- [ ] **JobPosting schema on listings page** — Each public listing could include JobPosting structured data. This directly feeds Google for Jobs and LLM understanding.

---

## P5 — GEO Monitoring & Measurement

Track whether LLMs are actually recommending Human Pages.

### Action Items

- [ ] **Set up manual monitoring cadence** — Weekly, prompt ChatGPT, Claude, Gemini, and Perplexity with: "best AI hiring platform", "how can an AI agent hire a human", "AI-to-human marketplace", "MCP servers for hiring". Log results in a spreadsheet.
- [ ] **Evaluate GEO tracking tools** — Check out Scrunch, Profound, Rankshift for automated "share of voice" tracking. Most are early-stage; assess if any are mature enough to use.
- [ ] **Source-attribution logging** — When agents register, ask (or infer from headers/referrer) how they discovered Human Pages. Track: direct, MCP directory, search, LLM recommendation, blog post, etc.
- [ ] **Track llms.txt crawl logs** — Monitor server logs for hits to `/llms.txt` and `/.well-known/openapi.json`. Track which bots are crawling and how often.

---

## Execution Priority

| Phase | Items | Effort | Impact | Timeline |
|-------|-------|--------|--------|----------|
| **Now** | Directory submissions (P2), Crunchbase + LinkedIn (P1), llmstxt directories (P2) | Low | Medium | This week |
| **Next 2 weeks** | Comparison articles (P0), Dev.to series (P3), npm README (P3), monitoring setup (P5) | Medium | High | 2 weeks |
| **Next month** | HN launch (P0), Product Hunt (P0), Reddit seeding (P0), Wikidata (P1), schema enhancements (P4) | Medium-High | High | 4 weeks |
| **Ongoing** | Guest posts (P0), YouTube (P3), GEO monitoring (P5), source-attribution logging (P5) | Ongoing | Cumulative | Continuous |

---

## Key Insight

The MCP server + llms.txt + OpenAPI spec is the future path (agents discovering tools programmatically). But today, LLM recommendations are still driven by what was in training data — which means the highest-ROI work right now is **getting mentioned in external content** (P0) and **being listed in directories** (P2). The technical infrastructure is already strong; the gap is distribution.
