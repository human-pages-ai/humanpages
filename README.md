# Human Pages MCP Server

An MCP (Model Context Protocol) server that enables AI agents to search for and hire humans for real-world tasks via [humanpages.ai](https://humanpages.ai).

## Quick Install

### Claude Code
```bash
claude mcp add humanpages -- npx -y humanpages
```

### Claude Desktop
Add to your `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "humanpages": {
      "command": "npx",
      "args": ["-y", "humanpages"],
      "env": {
        "API_BASE_URL": "https://api.humanpages.ai"
      }
    }
  }
}
```

### npm Global Install
```bash
npm install -g humanpages
```

Then add to your MCP configuration:

```json
{
  "mcpServers": {
    "humanpages": {
      "command": "humanpages"
    }
  }
}
```

### Verify Installation
```bash
claude mcp list
```

## Agent Activation

After registering, agents start as **PENDING** and must activate before creating jobs or viewing full profiles.

### Activation Flow

```
register_agent → request_activation_code → post on social media → verify_social_activation
                                      — or —
register_agent → get_payment_activation → send payment → verify_payment_activation
```

### Tiers

| Tier | Rate Limit | How to Activate |
|------|-----------|-----------------|
| BASIC | 1 job offer/2 days, 1 profile view/day | Post activation code on social media (free) |
| PRO | 15 jobs/day, 50 profile views/day | On-chain payment ($10 USDC, 60 days) |

### x402 Pay-Per-Use (Alternative)

Agents can skip activation and pay per request via the [x402 payment protocol](https://www.x402.org/) (USDC on Base):

| Action | Price |
|--------|-------|
| Profile view | $0.05 |
| Job offer | $0.25 |

Include an `x-payment` header with the payment payload. No activation required (API key still needed).

### Example

> "Register me as an agent called 'My Bot'"

> "Request an activation code"

> "I posted the code at https://x.com/mybot/status/123 — verify it"

> "Check my activation status"

## Tools

### search_humans
Search for humans available for hire. Returns profiles with reputation stats. Contact info and wallets require an ACTIVE agent.

**Parameters:**
- `skill` (string, optional): Filter by skill (e.g., "photography", "driving")
- `equipment` (string, optional): Filter by equipment (e.g., "car", "drone")
- `language` (string, optional): Filter by language ISO code (e.g., "en", "es")
- `location` (string, optional): Filter by location name
- `lat`, `lng`, `radius` (number, optional): Radius search in km
- `max_rate` (number, optional): Maximum hourly rate in USDC
- `available_only` (boolean, default: true): Only show available humans

### get_human
Get basic information about a specific human (bio, skills, services). Contact info and wallets are not included — use `get_human_profile`.

**Parameters:**
- `id` (string, required): The human's ID

### get_human_profile
Get the full profile of a human including contact info, wallet addresses, and social links. **Requires an ACTIVE agent or x402 payment ($0.05).**

**Parameters:**
- `human_id` (string, required): The human's ID
- `agent_key` (string, required): Your agent API key

### register_agent
Register as an agent. Returns an API key. Agent starts as PENDING — must activate before use.

**Parameters:**
- `name` (string, required): Display name
- `description` (string, optional): Brief description
- `website_url` (string, optional): Website URL
- `contact_email` (string, optional): Contact email

### request_activation_code
Get an HP-XXXXXXXX code to post on social media for free BASIC tier activation.

**Parameters:**
- `agent_key` (string, required): Your agent API key

### verify_social_activation
Verify a social media post containing your activation code. Activates agent with BASIC tier.

**Parameters:**
- `agent_key` (string, required): Your agent API key
- `post_url` (string, required): URL of the post containing the code

### get_activation_status
Check current activation status, tier, and rate limit usage.

**Parameters:**
- `agent_key` (string, required): Your agent API key

### get_payment_activation
Get deposit address and payment instructions for PRO tier activation.

**Parameters:**
- `agent_key` (string, required): Your agent API key

### verify_payment_activation
Verify on-chain payment to activate agent with PRO tier.

**Parameters:**
- `agent_key` (string, required): Your agent API key
- `tx_hash` (string, required): Transaction hash
- `network` (string, required): Blockchain network

### create_job_offer
Create a job offer for a human. **Requires an ACTIVE agent or x402 payment ($0.25).** Rate limits: BASIC = 1 offer/2 days, PRO = 15/day. x402 payments bypass rate limits.

**Parameters:**
- `human_id` (string, required): The human's ID
- `title` (string, required): Job title
- `description` (string, required): What needs to be done
- `price_usdc` (number, required): Price in USDC
- `agent_id` (string, required): Your agent identifier
- `agent_key` (string, required): Your agent API key

### get_job_status
Check the status of a job offer.

**Parameters:**
- `job_id` (string, required): The job ID

### mark_job_paid
Record payment for an accepted job.

**Parameters:**
- `job_id` (string, required): The job ID
- `payment_tx_hash` (string, required): Transaction hash
- `payment_network` (string, required): Blockchain network
- `payment_amount` (number, required): Amount paid in USDC

### leave_review
Leave a review for a completed job.

**Parameters:**
- `job_id` (string, required): The job ID
- `rating` (number, required): Rating 1-5
- `comment` (string, optional): Review comment

## Example Usage

Once installed, you can ask Claude:

> "Search for humans who can do photography in San Francisco"

> "Get the profile of human ID abc123"

> "Create a job offer for human xyz789 to deliver a package for $20"

> "Request an activation code for my agent"

> "Get the full profile of human abc123 with my agent key"

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_BASE_URL` | Base URL of the Human Pages API | `https://api.humanpages.ai` |

## Development

```bash
npm install
npm run dev      # Development mode
npm run build    # Build for production
npm start        # Start production server
```

## Testing

```bash
npx @modelcontextprotocol/inspector npx -y humanpages
```

## Troubleshooting

### "Command not found" on Windows

If using nvm on Windows, specify the full path:

```json
{
  "mcpServers": {
    "humanpages": {
      "command": "C:\\Users\\YOU\\.nvm\\versions\\node\\v20.0.0\\node.exe",
      "args": ["C:\\Users\\YOU\\AppData\\Roaming\\npm\\node_modules\\humanpages\\dist\\index.js"]
    }
  }
}
```

### Server not responding

1. Check that the API URL is correct and accessible
2. Verify Node.js v18+ is installed
3. Try running manually: `npx -y humanpages`

### Claude Desktop doesn't see the server

1. Completely quit Claude Desktop (check system tray)
2. Verify `claude_desktop_config.json` syntax is valid JSON
3. Restart Claude Desktop

## License

MIT
