import ConnectLayout from './ConnectLayout';
import { CodeBlock, StepByStep, Section, Callout, PlatformHero, TryItSection, ToolsReference, PlatformNav, RelatedPlatforms } from './shared';

const NANOBOT_YAML = `# nanobot.yaml — agent definition with HumanPages MCP
name: hiring-agent
instructions: You help users find and hire real humans for tasks.

mcpServers:
  humanpages:
    url: https://mcp.humanpages.ai/sse
    transport: sse`;

const NANOBOT_LOCAL = `# Or use local stdio transport
mcpServers:
  humanpages:
    command: npx
    args: ["-y", "humanpages"]
    env:
      API_BASE_URL: https://humanpages.ai`;

export default function NanobotPage() {
  return (
    <ConnectLayout
      title="Connect HumanPages to Nanobot"
      description="Add HumanPages MCP to Nanobot — the open-source framework that turns MCP servers into full AI agents with UI, memory, and reasoning."
      path="/dev/connect/nanobot"
      breadcrumbs={[{ label: 'Connect', href: '/dev/connect' }, { label: 'Nanobot' }]}
    >
      <PlatformHero
        gradient="from-cyan-50 to-teal-50"
        icon={<span>🐈</span>}
        name="Nanobot"
        tagline="Turn MCP servers into full agents — with UI, memory, and reasoning"
        docsUrl="https://github.com/nanobot-ai/nanobot"
      />

      <Callout type="info">
        Nanobot agents are themselves exposed as MCP servers — so your hiring agent can be used by other agents or MCP clients like Claude, Cursor, or ChatGPT.
      </Callout>

      <Section title="Setup">
        <StepByStep
          steps={[
            {
              title: 'Install Nanobot',
              detail: (
                <CodeBlock code={`# Install via Go\ngo install github.com/nanobot-ai/nanobot@latest\n\n# Or use the pre-built binary from GitHub releases`} lang="bash" filename="Terminal" />
              ),
            },
            {
              title: 'Create agent config with HumanPages',
              detail: (
                <div>
                  <CodeBlock code={NANOBOT_YAML} lang="yaml" filename="nanobot.yaml" />
                  <p className="text-sm text-slate-500 mt-2">Nanobot wraps the MCP tools with reasoning, system prompts, and tool orchestration automatically.</p>
                </div>
              ),
            },
            {
              title: 'Alternative: local stdio',
              detail: (
                <CodeBlock code={NANOBOT_LOCAL} lang="yaml" filename="nanobot.yaml (local)" />
              ),
            },
            {
              title: 'Run the agent',
              detail: (
                <CodeBlock code="nanobot run" lang="bash" filename="Terminal" />
              ),
            },
          ]}
        />
      </Section>

      <Section title="Why Nanobot + HumanPages">
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="bg-cyan-50 rounded-lg p-4 border border-cyan-100">
            <p className="font-semibold text-cyan-900 mb-1">MCP-UI</p>
            <p className="text-sm text-cyan-700">Render interactive React components in chat — show human profiles, job cards, and hiring flows inline.</p>
          </div>
          <div className="bg-cyan-50 rounded-lg p-4 border border-cyan-100">
            <p className="font-semibold text-cyan-900 mb-1">Agent-as-MCP</p>
            <p className="text-sm text-cyan-700">Your hiring agent becomes an MCP server itself — composable with other agents.</p>
          </div>
          <div className="bg-cyan-50 rounded-lg p-4 border border-cyan-100">
            <p className="font-semibold text-cyan-900 mb-1">Go backend</p>
            <p className="text-sm text-cyan-700">Ultra-low latency with real-time streaming from MCP tools to the UI.</p>
          </div>
        </div>
      </Section>

      <ToolsReference />
      <TryItSection />
      <RelatedPlatforms currentSlug="nanobot" slugs={['nanoclaw', 'langchain', 'openai-agents', 'clawhub']} />
      <PlatformNav currentSlug="nanobot" />
    </ConnectLayout>
  );
}
