import ConnectLayout from './ConnectLayout';
import { CodeBlock, StepByStep, Section, Callout, PlatformHero, TryItSection, ToolsReference } from './shared';

const SETTINGS_JSON = `{
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

export default function GeminiPage() {
  return (
    <ConnectLayout
      title="Connect HumanPages to Gemini CLI"
      description="Add HumanPages MCP server to Gemini CLI. Find and hire real humans from Google's command-line AI assistant."
      path="/dev/connect/gemini"
      breadcrumbs={[{ label: 'Connect', href: '/dev/connect' }, { label: 'Gemini CLI' }]}
    >
      <PlatformHero
        gradient="from-blue-50 to-sky-50"
        icon={<span>♊</span>}
        name="Gemini CLI"
        tagline="Google's command-line AI with MCP support"
        docsUrl="https://geminicli.com/docs/tools/mcp-server/"
      />

      <Section title="Setup">
        <StepByStep
          steps={[
            {
              title: 'Install Gemini CLI',
              detail: (
                <div>
                  <p className="mb-2">If you haven't already:</p>
                  <CodeBlock code="npm install -g @anthropic-ai/gemini-cli" lang="bash" filename="Terminal" />
                </div>
              ),
            },
            {
              title: 'Edit settings.json',
              detail: (
                <div>
                  <p className="mb-2">Open <code>~/.gemini/settings.json</code> and add the HumanPages server:</p>
                  <CodeBlock code={SETTINGS_JSON} lang="json" filename="~/.gemini/settings.json" />
                </div>
              ),
            },
            {
              title: 'Restart and verify',
              detail: <p>Restart Gemini CLI. The HumanPages tools will be available in your next session.</p>,
            },
          ]}
        />
      </Section>

      <Callout type="info">
        Gemini CLI primarily supports <strong>stdio transport</strong> (local npx). Remote HTTP support may vary — check the latest Gemini CLI docs for updates.
      </Callout>

      <Section title="Config file location">
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
          <code className="text-sm text-slate-600">~/.gemini/settings.json</code>
        </div>
      </Section>

      <ToolsReference />
      <TryItSection />
    </ConnectLayout>
  );
}
