# /dev/connect — Implementation Plan

## Context

This plan was developed through a war room session analyzing how to share humanpages.ai in WhatsApp dev groups. The core insight: `/dev` should be a short, punchy landing page (value prop + services), and technical docs/setup should live on sub-routes.

## Final URL Structure

| Route | Purpose | Status |
|-------|---------|--------|
| `/dev` | Landing page — value prop, services with prices, one CTA ("Install MCP") | Needs restructuring (currently too long, has both value prop AND full docs) |
| `/dev/setup` | MCP install instructions, API docs, tools list, pricing tiers | New page — move current `/dev` technical content here |
| `/dev/connect/gpt` | GPT/OpenAI-specific integration guide | New page |
| `/dev/connect` | Overview page with sections for each platform (Claude, GPT, Gemini, etc.) | New page |
| `/use-cases` | Keep alive for SEO — redirect or secondary page | Existing, keep as-is |

## OG Preview (DONE — already wired into codebase)

**og:title:** `HumanPages.ai | Real-world tasks for your AI Agent`
**og:description:** `You prompt, humans deliver. Connect the MCP and delegate tasks automatically.`
**og:image:** `/api/og/use-cases` (monospace font, navy bg, matching brand style)

These are already updated in:
- `backend/src/routes/og.ts` — `generateUseCasesSvg()` + `/api/og/use-cases` route
- `backend/src/lib/seo.ts` — both `getDevPageMetaHtml()` and `getUseCasesMetaHtml()`
- `frontend/src/pages/UseCasesPage.tsx` — SEO component
- `frontend/src/pages/DevelopersPage.tsx` — SEO component

## /dev Landing Page — What It Should Become

Strip down to just:

1. **Hero** — "Let your AI agent hire real humans. From one prompt." + Install MCP CTA
2. **Services grid** — 6-7 cards with service name + price:
   - Directory Submissions — $5/batch (10-15 directories)
   - QA Testing — $3-$10/session
   - Play Store Beta Testers — $18-$30
   - Localization Review — $5-$15/language
   - Competitor Monitoring — $3-$8/week
   - Community Management — $25/week
   - Virtual Assistant — $5-$15/hour
3. **How it works** — 3 steps: Your agent searches → Creates job offer → Human delivers
4. **One CTA** — "Install MCP" button → links to `/dev/setup`
5. **Secondary link** — "Connect from GPT, Gemini, or other platforms" → `/dev/connect`

Content currently on `/dev` that should MOVE to `/dev/setup`:
- MCP install options (Option A: .mcp.json, Option B: CLI, Option C: ClawHub)
- Full tools list (search_humans, get_human, get_human_profile, register_agent, etc.)
- REST API reference
- Pricing tiers (BASIC/PRO/x402)
- Example usage code blocks

## /dev/connect — Platform Integration Hub

Single page with sections for each platform:

### Supported MCP Clients
| Client | Config | Notes |
|--------|--------|-------|
| Claude Desktop / Claude Code | `.mcp.json` or `claude mcp add` | Primary audience |
| Cursor / Windsurf | `.mcp.json` | Same config format |
| Gemini CLI | Native MCP support | `gemini-cli` reads MCP config |
| Android Studio (Gemini) | Built-in MCP server support | For Android devs |
| ChatGPT (Developer Mode) | Full MCP since Oct 2025 | Business/Enterprise, read-only for Pro |
| OpenAI Agents SDK | Native MCP tool type | Programmatic agents |
| OpenAI Responses API | MCP as first-class tool | Remote MCP servers |
| LangChain / LlamaIndex | MCP client libraries | Framework-level |

### Non-MCP Methods
| Method | How | Who |
|--------|-----|-----|
| REST API | Direct HTTP to `humanpages.ai/api/` | Any agent with HTTP |
| CLAUDE.md / .cursorrules | Paste agent instructions | Low-friction, no MCP needed |
| Custom tool calling | Define as function/tool | GPT function calling, Gemini tool use |

## /dev/connect/gpt — GPT-Specific Page

Dedicated guide for OpenAI ecosystem:
- ChatGPT Developer Mode MCP setup
- OpenAI Agents SDK integration
- OpenAI Responses API MCP tool type
- Function calling fallback (REST API)

## WhatsApp Campaign Plan

**Link to share:** `humanpages.ai/dev`

**DM message template:**
> hey check this out - built an MCP that handles directory submissions + other stuff automatically. Your Claude agent (or GPT) hires a real human and they do the work. Free invites for friends 👇
> humanpages.ai/dev

**Post-delivery feedback:** Set up Typeform with 3 questions:
1. Did you get value from the service? (Yes / Somewhat / No)
2. Would you use this again? (Yes, I'd pay / Maybe / No)
3. Any feedback? (open text)

## Key Decisions Made

1. **Endpoint naming:** `/dev` wins over `/use-cases`, `/hire-real-humans`, `/boost-your-website` etc. for WhatsApp credibility
2. **OG image font:** Monospace (DejaVu Sans Mono) for dev-tool aesthetic — ensure production server has this font
3. **Description language:** "Delegate" not "hire" (dev mindset), avoid "humans as a service" (commodifying), "You prompt, humans deliver" is the tagline
4. **No price in OG:** Dropped "$3-$30" to avoid Fiverr association and "cheap" signal
5. **The directory submissions vertical** is a VC proof-of-concept funded by founder
6. **Free invites** = coupon codes refunding the $5 cost

## Files Changed (already committed)

- `backend/src/routes/og.ts` — Added `generateUseCasesSvg()` + `/api/og/use-cases` route
- `backend/src/lib/seo.ts` — Updated title/description/image for both `/dev` and `/use-cases`
- `frontend/src/pages/UseCasesPage.tsx` — Updated SEO component
- `frontend/src/pages/DevelopersPage.tsx` — Updated SEO component

## OG Preview Assets

All rendered PNGs are in `og-previews/` folder:
- `matched-final.png` — The final OG image (brand-matched style)
- `font-C-all-mono.png` — The monospace variant (what's in the codebase)
- `whatsapp-mockup.png` — Full WhatsApp group chat simulation
- Various iterations (v1-v8) for reference
