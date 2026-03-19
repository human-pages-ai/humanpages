import ConnectLayout from './ConnectLayout';
import { CodeBlock, StepByStep, Section, Callout, PlatformHero, TryItSection, ToolsReference, PlatformNav, RelatedPlatforms } from './shared';

const LOCAL_CONFIG = `{
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
      "serverUrl": "https://mcp.humanpages.ai/sse"
    }
  }
}`;

export default function WindsurfPage() {
  return (
    <ConnectLayout
      title="Connect HumanPages to Windsurf"
      description="Add HumanPages MCP to Windsurf IDE by Codeium. Hire real humans from Cascade conversations."
      path="/dev/connect/windsurf"
      breadcrumbs={[{ label: 'Connect', href: '/dev/connect' }, { label: 'Windsurf' }]}
    >
      <PlatformHero
        gradient="from-teal-50 to-cyan-50"
        icon={<span>🏄</span>}
        name="Windsurf"
        tagline="Codeium's agentic IDE — uses serverUrl for remote MCP"
        docsUrl="https://docs.windsurf.com/windsurf/cascade/mcp"
      />

      <Section title="Setup via config file">
        <StepByStep
          steps={[
            {
              title: 'Open MCP config',
              detail: <p>Click the <strong>MCPs icon</strong> (top-right of the Cascade panel) → <strong>Configure</strong>. This opens <code>mcp_config.json</code>.</p>,
            },
            {
              title: 'Add HumanPages (remote)',
              detail: (
                <div>
                  <p className="mb-2">For the hosted server — no local dependencies:</p>
                  <CodeBlock code={REMOTE_CONFIG} lang="json" filename="mcp_config.json" />
                </div>
              ),
            },
            {
              title: 'Or use local (npx)',
              detail: (
                <div>
                  <CodeBlock code={LOCAL_CONFIG} lang="json" filename="mcp_config.json" />
                </div>
              ),
            },
            {
              title: 'Refresh and verify',
              detail: <p>Click the MCPs icon again — you should see "humanpages" with a connected status.</p>,
            },
          ]}
        />
      </Section>

      <Callout type="info">
        <strong>Windsurf difference:</strong> Remote servers use <code>serverUrl</code> (not <code>url</code> or <code>type</code>). This is unique to Windsurf — other platforms use <code>"type": "http"</code>.
      </Callout>

      <Section title="Config file location">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
            <p className="font-semibold text-slate-900 mb-1">macOS / Linux</p>
            <code className="text-xs text-slate-600 break-all">~/.codeium/windsurf/mcp_config.json</code>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
            <p className="font-semibold text-slate-900 mb-1">Windows</p>
            <code className="text-xs text-slate-600 break-all">%USERPROFILE%\.codeium\windsurf\mcp_config.json</code>
          </div>
        </div>
      </Section>

      <Callout type="tip">
        If your team uses Windsurf's <strong>whitelist feature</strong>, an admin will need to allow <code>mcp.humanpages.ai</code> before team members can connect.
      </Callout>

      <ToolsReference />
      <TryItSection />
      <RelatedPlatforms currentSlug="windsurf" slugs={['claude', 'cursor', 'chatgpt', 'smithery']} />
      <PlatformNav currentSlug="windsurf" />
    </ConnectLayout>
  );
}
