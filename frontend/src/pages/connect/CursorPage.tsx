import ConnectLayout from './ConnectLayout';
import { CodeBlock, StepByStep, Section, Callout, PlatformHero, TryItSection, ToolsReference, QuickCopyCard, PlatformNav, RelatedPlatforms, HowToSchema } from './shared';

const GLOBAL_CONFIG = `{
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

const REMOTE_CONFIG = `{
  "mcpServers": {
    "humanpages": {
      "type": "http",
      "url": "https://mcp.humanpages.ai/mcp"
    }
  }
}`;

export default function CursorPage() {
  return (
    <ConnectLayout
      title="Connect HumanPages to Cursor"
      description="Add HumanPages MCP to Cursor IDE. Search and hire real humans for tasks directly from your code editor."
      path="/dev/connect/cursor"
      breadcrumbs={[{ label: 'Connect', href: '/dev/connect' }, { label: 'Cursor' }]}
    >
      <HowToSchema
        name="How to connect HumanPages MCP to Cursor IDE"
        description="Add HumanPages MCP server to Cursor IDE to search and hire real humans from your code editor."
        steps={[
          { name: 'Create .cursor/mcp.json', text: 'In your project root, create .cursor/mcp.json and add the HumanPages server config.' },
          { name: 'Verify in Settings', text: 'Open Settings → Tools & MCP. You should see humanpages listed with a green status indicator.' },
          { name: 'Use in Agent mode', text: 'Switch to Agent mode in the chat panel. MCP tools are only available in Agent mode.' },
        ]}
      />

      <PlatformHero
        gradient="from-blue-50 to-indigo-50"
        icon={<span>⚡</span>}
        name="Cursor"
        tagline="AI-first code editor — same MCP config format you already know"
        docsUrl="https://cursor.com/docs/context/mcp"
      />

      <Section title="Option A — Local (npx)">
        <StepByStep
          steps={[
            {
              title: 'Create or open .cursor/mcp.json',
              detail: (
                <div>
                  <p className="mb-2">In your project root, create <code>.cursor/mcp.json</code>. Or for global config, edit <code>~/.cursor/mcp.json</code>.</p>
                  <CodeBlock code={GLOBAL_CONFIG} lang="json" filename=".cursor/mcp.json" />
                </div>
              ),
            },
            {
              title: 'Verify in Settings',
              detail: <p>Open <strong>Settings → Tools & MCP</strong>. You should see "humanpages" listed with a green status indicator.</p>,
            },
            {
              title: 'Use in Agent mode',
              detail: <p>Switch to Agent mode (not Ask) in the chat panel. The MCP tools are only available in Agent mode.</p>,
            },
          ]}
        />
      </Section>

      <Section title="Option B — Remote (HTTP)">
        <p className="text-slate-600 mb-4">
          No npx needed — connect directly to the hosted MCP server:
        </p>
        <CodeBlock code={REMOTE_CONFIG} lang="json" filename=".cursor/mcp.json (remote)" />
        <Callout type="info">
          Remote mode means zero local dependencies. The MCP server runs on our infrastructure and Cursor connects over HTTPS.
        </Callout>
      </Section>

      <Section title="Config file locations">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
            <p className="font-semibold text-slate-900 mb-1">Per-project</p>
            <code className="text-xs text-slate-600">.cursor/mcp.json</code>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
            <p className="font-semibold text-slate-900 mb-1">Global</p>
            <code className="text-xs text-slate-600">~/.cursor/mcp.json</code>
          </div>
        </div>
      </Section>

      <Callout type="warn">
        Cursor MCP tools only work in <strong>Agent mode</strong>, not in Ask or Edit modes. Make sure Agent is selected in the chat dropdown.
      </Callout>

      <QuickCopyCard
        configs={[
          { label: 'Local (npx)', code: GLOBAL_CONFIG },
          { label: 'Remote (HTTP)', code: REMOTE_CONFIG },
        ]}
      />

      <ToolsReference />
      <TryItSection platformName="Cursor" />
      <RelatedPlatforms currentSlug="cursor" slugs={['claude', 'windsurf', 'chatgpt', 'smithery']} />
      <PlatformNav currentSlug="cursor" />
    </ConnectLayout>
  );
}
