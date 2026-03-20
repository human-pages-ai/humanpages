import ConnectLayout from './ConnectLayout';
import {
  CodeBlock, StepByStep, Section, Callout, PlatformHero,
  TryItSection, ToolsReference, QuickCopyCard, PlatformNav,
  RelatedPlatforms, HowToSchema,
} from './shared';

const DESKTOP_CONFIG = `{
  "mcpServers": {
    "humanpages": {
      "command": "npx",
      "args": ["-y", "humanpages"],
      "env": {
        "API_BASE_URL": "https://humanpages.ai"
      }
    }
  }
}`;

const DESKTOP_REMOTE = `{
  "mcpServers": {
    "humanpages": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.humanpages.ai/mcp"]
    }
  }
}`;

const CODE_CLI = `claude mcp add humanpages -- npx -y humanpages`;
const CODE_REMOTE = `claude mcp add --transport http humanpages https://mcp.humanpages.ai/mcp`;

const MCP_JSON = `{
  "mcpServers": {
    "humanpages": {
      "type": "http",
      "url": "https://mcp.humanpages.ai/mcp"
    }
  }
}`;

export default function ClaudePage() {
  return (
    <ConnectLayout
      title="Connect HumanPages MCP to Claude Desktop & Claude Code"
      description="Step-by-step guide to add HumanPages MCP server to Claude Desktop or Claude Code. Find and hire real humans directly from Claude conversations. Copy-paste config included."
      path="/dev/connect/claude"
      breadcrumbs={[{ label: 'Connect', href: '/dev/connect' }, { label: 'Claude' }]}
      ogPlatform="claude"
    >
      <HowToSchema
        name="How to connect HumanPages MCP to Claude"
        description="Add HumanPages MCP server to Claude Desktop or Claude Code to search and hire real humans from AI conversations."
        steps={[
          { name: 'Open Claude settings', text: 'In Claude Desktop, go to Settings → Developer → Edit Config. In Claude Code, open a terminal.' },
          { name: 'Add HumanPages config', text: 'Paste the MCP server configuration into claude_desktop_config.json, or run: claude mcp add humanpages -- npx -y humanpages' },
          { name: 'Restart and verify', text: 'Restart Claude Desktop or start a new Claude Code session. The HumanPages tools should now appear.' },
        ]}
      />

      <PlatformHero
        gradient="from-orange-50 to-amber-50"
        icon={<span>🟤</span>}
        name="Claude Desktop & Claude Code"
        tagline="The primary MCP ecosystem — where it all started"
        docsUrl="https://docs.anthropic.com/en/docs/agents-and-tools/mcp"
      />

      {/* Quick-copy for skimmers */}
      <QuickCopyCard
        configs={[
          { label: 'Claude Code (CLI)', code: CODE_CLI },
          { label: 'Claude Code (remote)', code: CODE_REMOTE },
          { label: '.mcp.json (project)', code: MCP_JSON },
          { label: 'Desktop config', code: DESKTOP_CONFIG },
        ]}
      />

      {/* ── Claude Code (fastest) ───────────────────────────── */}
      <Section title="Claude Code — one command">
        <p className="text-slate-600 mb-4">
          If you have Claude Code installed, this is the fastest way. Run it from any project directory:
        </p>
        <CodeBlock code={CODE_CLI} lang="bash" filename="Terminal" />
        <p className="text-sm text-slate-500 mt-3">
          This runs the MCP server locally via npx. For a remote connection instead:
        </p>
        <div className="mt-3">
          <CodeBlock code={CODE_REMOTE} lang="bash" filename="Terminal (remote)" />
        </div>
        <Callout type="tip">
          You can also add it to a project-level <code>.mcp.json</code> so teammates get it automatically:
        </Callout>
        <div className="mt-3">
          <CodeBlock code={MCP_JSON} lang="json" filename=".mcp.json (project root)" />
        </div>
      </Section>

      {/* ── Claude Desktop ──────────────────────────────────── */}
      <Section title="Claude Desktop — config file">
        <StepByStep
          steps={[
            {
              title: 'Open Claude Desktop settings',
              detail: <p>Click the menu icon → <strong>Settings</strong> → <strong>Developer</strong> → <strong>Edit Config</strong>. This opens <code>claude_desktop_config.json</code>.</p>,
            },
            {
              title: 'Add the HumanPages server',
              detail: (
                <div>
                  <p className="mb-3">Paste this into the config file (local via npx):</p>
                  <CodeBlock code={DESKTOP_CONFIG} lang="json" filename="claude_desktop_config.json" />
                </div>
              ),
            },
            {
              title: 'Restart Claude Desktop',
              detail: <p>Quit and reopen Claude. You should see a hammer icon with the HumanPages tools available.</p>,
            },
          ]}
        />

        <div className="mt-6">
          <Callout type="info">
            Claude Desktop doesn't natively support remote HTTP servers in the config file. To use the remote server, use the <code>mcp-remote</code> wrapper:
          </Callout>
          <div className="mt-3">
            <CodeBlock code={DESKTOP_REMOTE} lang="json" filename="claude_desktop_config.json (remote)" />
          </div>
        </div>
      </Section>

      {/* ── Config file locations ───────────────────────────── */}
      <Section title="Config file locations">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
            <p className="font-semibold text-slate-900 mb-1">Claude Desktop</p>
            <code className="text-xs text-slate-600 break-all">macOS: ~/Library/Application Support/Claude/claude_desktop_config.json</code>
            <br />
            <code className="text-xs text-slate-600 break-all">Windows: %APPDATA%\Claude\claude_desktop_config.json</code>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
            <p className="font-semibold text-slate-900 mb-1">Claude Code</p>
            <code className="text-xs text-slate-600 break-all">User: ~/.claude.json</code>
            <br />
            <code className="text-xs text-slate-600 break-all">Project: .mcp.json (in project root)</code>
          </div>
        </div>
      </Section>

      <ToolsReference />
      <TryItSection platformName="Claude" />
      <RelatedPlatforms currentSlug="claude" slugs={['cursor', 'windsurf', 'chatgpt', 'smithery', 'clawhub']} />
      <PlatformNav currentSlug="claude" />
    </ConnectLayout>
  );
}
