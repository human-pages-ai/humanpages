# Installing the Humans MCP Server

The Humans MCP Server allows AI agents to search for and hire humans for real-world tasks.

## Available Tools

| Tool | Description |
|------|-------------|
| `search_humans` | Search for humans by skill, location, or availability |
| `get_human` | Get detailed profile of a specific human |
| `record_job` | Record a job assignment for tracking |

---

## Option 1: Claude Desktop (Recommended)

### Download and Install

1. Download `humans.mcpb` from the [releases page](https://github.com/anthropics/humans-mcp/releases)
2. Double-click the file to install
3. Restart Claude Desktop

### Manual Configuration

If the bundle doesn't auto-install, add to your `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "humans": {
      "command": "npx",
      "args": ["-y", "@anthropic/humans-mcp"],
      "env": {
        "HUMANS_API_URL": "https://api.humans.example.com"
      }
    }
  }
}
```

---

## Option 2: Claude Code CLI

Run this single command:

```bash
claude mcp add humans -- npx -y @anthropic/humans-mcp
```

### With Custom API URL

```bash
claude mcp add humans --env HUMANS_API_URL=https://your-api.com -- npx -y @anthropic/humans-mcp
```

### Verify Installation

```bash
claude mcp list
```

---

## Option 3: npm Global Install

```bash
npm install -g @anthropic/humans-mcp
```

Then add to your MCP configuration:

```json
{
  "mcpServers": {
    "humans": {
      "command": "humans-mcp"
    }
  }
}
```

---

## Option 4: Run from Source

```bash
git clone https://github.com/anthropics/humans-mcp
cd humans-mcp/mcp-server
npm install
npm run build
npm start
```

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `HUMANS_API_URL` | Base URL of the Humans API | `http://localhost:3001` |

### Example Usage in Claude

Once installed, you can ask Claude:

> "Search for humans who can do photography in San Francisco"

> "Get the profile of human ID abc123"

> "Record that I've assigned the research task to human xyz789 for $50"

---

## Testing with MCP Inspector

Verify your installation works correctly:

```bash
npx @modelcontextprotocol/inspector npx -y @anthropic/humans-mcp
```

This opens a web UI where you can test each tool.

---

## Troubleshooting

### "Command not found" on Windows

If using nvm on Windows, specify the full path:

```json
{
  "mcpServers": {
    "humans": {
      "command": "C:\\Users\\YOU\\.nvm\\versions\\node\\v20.0.0\\node.exe",
      "args": ["C:\\Users\\YOU\\AppData\\Roaming\\npm\\node_modules\\@anthropic\\humans-mcp\\dist\\index.js"]
    }
  }
}
```

### Server not responding

1. Check that the API URL is correct and accessible
2. Verify Node.js v18+ is installed
3. Try running manually: `npx -y @anthropic/humans-mcp`

### Claude Desktop doesn't see the server

1. Completely quit Claude Desktop (check system tray)
2. Verify `claude_desktop_config.json` syntax is valid JSON
3. Restart Claude Desktop

---

## Support

- Issues: [GitHub Issues](https://github.com/anthropics/humans-mcp/issues)
- Documentation: [humans.example.com/docs](https://humans.example.com/docs)
