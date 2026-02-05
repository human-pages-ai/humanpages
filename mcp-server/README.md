# Humans MCP Server

An MCP (Model Context Protocol) server that enables AI agents to search for and hire humans for real-world tasks.

## Quick Install

### Claude Code
```bash
claude mcp add humans -- npx -y @anthropic/humans-mcp
```

### Claude Desktop
Add to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "humans": {
      "command": "npx",
      "args": ["-y", "@anthropic/humans-mcp"]
    }
  }
}
```

## Tools

### search_humans
Search for humans available for hire.

**Parameters:**
- `skill` (string, optional): Filter by skill
- `location` (string, optional): Filter by location
- `available_only` (boolean, default: true): Only show available humans

**Example:**
```
Search for humans with javascript skills in New York
```

### get_human
Get detailed information about a specific human.

**Parameters:**
- `id` (string, required): The human's ID

**Example:**
```
Get the profile for human clx123abc
```

### record_job
Record a job assignment for tracking.

**Parameters:**
- `human_id` (string, required): The human's ID
- `task_description` (string, required): Description of the task
- `task_category` (string, optional): Category of the task
- `agreed_price` (string, optional): Agreed price

**Example:**
```
Record that I've assigned the data analysis task to human clx123abc for $100
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HUMANS_API_URL` | Base URL of the Humans API | `http://localhost:3001` |

## License

MIT
