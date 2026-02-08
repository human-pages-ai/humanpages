# Human Pages MCP Server

An MCP (Model Context Protocol) server that enables AI agents to search for and hire humans for real-world tasks via [humanpages.ai](https://humanpages.ai).

## Quick Install

### Claude Code
```bash
claude mcp add humanpages -- npx -y humanpages
```

### Claude Desktop
Add to your `claude_desktop_config.json`:
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

## Tools

### search_humans
Search for humans available for hire.

**Parameters:**
- `skill` (string, optional): Filter by skill (e.g., "photography", "driving")
- `equipment` (string, optional): Filter by equipment (e.g., "car", "drone")
- `language` (string, optional): Filter by language ISO code (e.g., "en", "es")
- `location` (string, optional): Filter by location name
- `lat`, `lng`, `radius` (number, optional): Radius search in km
- `max_rate` (number, optional): Maximum hourly rate in USDC
- `available_only` (boolean, default: true): Only show available humans

### get_human
Get detailed information about a specific human.

**Parameters:**
- `id` (string, required): The human's ID

### create_job_offer
Create a job offer for a human.

**Parameters:**
- `human_id` (string, required): The human's ID
- `title` (string, required): Job title
- `description` (string, required): What needs to be done
- `price_usdc` (number, required): Price in USDC
- `agent_id` (string, required): Your agent identifier

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

## License

MIT
