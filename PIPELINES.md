# Content Automation Pipelines

Human Pages runs 4 nightly content pipelines via systemd user timers. Each pipeline lives in its own repo under `~/projects/` and runs on a staggered schedule to avoid Claude rate limit conflicts.

## Schedule

| Time | Service | Repo | What it does |
|------|---------|------|-------------|
| 1:00 AM | reply-engine | `~/projects/reply-engine` | Scans 13 social platforms for relevant conversations, drafts contextual replies |
| 2:00 AM | blog-engine | `~/projects/blog-engine` | Discovers trending topics from Google News/HN/Reddit/DEV.to, generates article drafts |
| 3:00 AM | youtube-outreach | `~/projects/youtube-outreach` | Discovers YouTube channels, LLM-scores relevance, generates comments for staff to post |
| 4:00 AM | video-pipeline | `~/projects/video-pipeline` | Generates 15 nano video concepts for review |

All pipelines use Claude Max subscription (Agent SDK or CLI) for LLM calls. No API key needed.

## Fresh Machine Install

### 1. Clone all repos

```bash
mkdir -p ~/projects && cd ~/projects
git clone git@github.com:evyatar-code/reply-engine.git
git clone git@github.com:evyatar-code/blog-engine.git
git clone git@github.com:evyatar-code/youtube-outreach.git
git clone git@github.com:evyatar-code/video-pipeline.git
```

### 2. Prerequisites

```bash
# Node.js 20+ (via nvm)
nvm install 20 && nvm use 20

# Python 3.10+ (for video-pipeline)
sudo apt install python3 python3-pip

# Claude Code CLI (for Max subscription auth)
# Install and login: https://docs.anthropic.com/en/docs/claude-code
```

### 3. Configure environment variables

Each repo has a `.env.example` — copy to `.env` and fill in keys:

```bash
cd ~/projects/reply-engine  && cp .env.example .env   # X, Reddit, Telegram keys
cd ~/projects/blog-engine   && cp .env.example .env   # Dashboard keys (optional)
cd ~/projects/youtube-outreach && cp .env.example .env # YouTube API + Dashboard keys
cd ~/projects/video-pipeline   && cp .env.example .env # fal.ai, ElevenLabs keys
```

See `PROD.md` in each repo for details on which variables are required vs optional.

### 4. Install everything

```bash
./install-content-services.sh
```

This will:
- Run `npm install` for the 3 Node.js pipelines
- Run `pip install -r requirements.txt` for video-pipeline
- Warn about any missing `.env` files
- Symlink all systemd service/timer files to `~/.config/systemd/user/`
- Enable all timers
- Enable linger (so timers run even when logged out)

## Managing Services

```bash
# Check status of all services
./install-content-services.sh status

# Stop all timers
./install-content-services.sh stop

# Trigger all services immediately
./install-content-services.sh run

# Trigger a single service
./install-content-services.sh run reply-engine.service

# Manually run a pipeline
cd ~/projects/youtube-outreach && npx tsx youtube-nightly.ts --dry-run
cd ~/projects/reply-engine && npx tsx src/index.ts search-once
cd ~/projects/blog-engine && npx tsx src/index.ts run
cd ~/projects/video-pipeline && python3 batch_concepts.py --count 15
```

## Logs

```bash
tail -f ~/projects/reply-engine/logs/nightly.log
tail -f ~/projects/blog-engine/logs/nightly.log
tail -f ~/projects/youtube-outreach/logs/nightly-systemd.log
tail -f ~/projects/video-pipeline/logs/batch.log
```

## Architecture

Each pipeline follows the same pattern:
1. **Discovery** — Find new content/channels/conversations (API calls, no LLM)
2. **Scoring** — LLM evaluates relevance (Claude Haiku, cheap)
3. **Generation** — LLM creates content (Claude Sonnet, balanced)
4. **Dashboard** — Posts tasks to the admin dashboard at humanpages.ai for staff to review and publish

Failed LLM calls are never persisted — they get retried on the next run. Discovery results accumulate regardless of whether Claude is available.
