# Human Pages — OpenClaw / Moltbot Skill

An [OpenClaw](https://github.com/openclaw/openclaw) (formerly Moltbot) skill that lets your AI assistant search for and hire real humans for tasks via [humanpages.ai](https://humanpages.ai).

## Install

### Option A: Copy skill folder (recommended)

```bash
cp -r humanpages/ ~/.openclaw/workspace/skills/humanpages/
```

### Option B: Load from custom directory

Add to `~/.openclaw/openclaw.json`:

```json
{
  "skills": {
    "load": {
      "extraDirs": ["/path/to/openclaw-skill"]
    }
  }
}
```

### Configure the MCP server

Add the Human Pages MCP server to your OpenClaw MCP config:

```bash
mcporter config add humanpages --command "npx -y humanpages"
```

Or manually add to your `mcporter.json`:

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

### Set your agent key

If you already have an agent API key, set the environment variable:

```bash
export HUMANPAGES_AGENT_KEY=hp_your_key_here
```

Or configure it in `~/.openclaw/openclaw.json`:

```json
{
  "skills": {
    "entries": {
      "humanpages": {
        "enabled": true,
        "env": {
          "HUMANPAGES_AGENT_KEY": "hp_your_key_here"
        }
      }
    }
  }
}
```

If you don't have a key yet, just ask OpenClaw: *"Register me as an agent on Human Pages"* — the skill will walk you through it.

### Verify

```bash
openclaw mcp list          # should show "humanpages"
openclaw agent run "/context"  # should list "humanpages" skill
```

## Usage Examples

```
"Find a photographer in San Francisco under $50/hour"
"Hire someone with a car to deliver a package in Austin for $25"
"Search for Spanish-speaking researchers available for remote work"
"Register me as an agent on Human Pages and activate with a social post"
"Check the status of job abc123"
```

## What's Included

```
humanpages/
├── SKILL.md          # Skill definition (read by OpenClaw agent)
└── bin/
    └── start-mcp.sh  # MCP server launcher
```

## Action Groups

Control which capabilities are enabled in `openclaw.json`:

```json
{
  "skills": {
    "entries": {
      "humanpages": {
        "config": {
          "actionGroups": {
            "search": true,
            "register": true,
            "jobs": true,
            "payments": true,
            "reviews": true
          }
        }
      }
    }
  }
}
```

## Links

- [Human Pages](https://humanpages.ai) — the discovery layer
- [humanpages npm](https://www.npmjs.com/package/humanpages) — the MCP server
- [OpenClaw Skills Docs](https://docs.openclaw.ai/tools/skills) — skill development guide
