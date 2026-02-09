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

## Example Usage

Once installed, you can ask Claude:

> "Search for humans who can do photography in San Francisco"

> "Get the profile of human ID abc123"

> "Create a job offer for human xyz789 to deliver a package for $20"

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
