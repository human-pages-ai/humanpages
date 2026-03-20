import ConnectLayout from './ConnectLayout';
import { CodeBlock, StepByStep, Section, Callout, PlatformHero, TryItSection, ToolsReference, PlatformNav, RelatedPlatforms } from './shared';

const MCP_JSON = `// .mcp.json — add HumanPages to your NanoClaw agent
{
  "mcpServers": {
    "humanpages": {
      "command": "npx",
      "args": ["-y", "humanpages"]
    }
  }
}`;

export default function NanoClawPage() {
  return (
    <ConnectLayout
      title="Connect HumanPages to NanoClaw"
      description="Add HumanPages MCP to your NanoClaw agent. Hire real humans from a secure, containerized AI assistant connected to WhatsApp, Telegram, Slack, and more."
      path="/dev/connect/nanoclaw"
      breadcrumbs={[{ label: 'Connect', href: '/dev/connect' }, { label: 'NanoClaw' }]}
      ogPlatform="nanoclaw"
    >
      <PlatformHero
        gradient="from-indigo-50 to-blue-50"
        icon={<span>🐳</span>}
        name="NanoClaw"
        tagline="Secure containerized agents with multi-channel messaging"
        docsUrl="https://github.com/qwibitai/nanoclaw"
      />

      <Callout type="info">
        NanoClaw runs each agent in its own Docker Sandbox or Apple Container. MCP servers you add run <strong>inside</strong> the container — isolated from your host system.
      </Callout>

      <Section title="Setup">
        <StepByStep
          steps={[
            {
              title: 'Fork & clone NanoClaw',
              detail: (
                <div>
                  <CodeBlock code={`gh repo fork qwibitai/nanoclaw --clone\ncd nanoclaw\nclaude`} lang="bash" filename="Terminal" />
                  <p className="text-sm text-slate-500 mt-2">Then run <code>/setup</code> inside Claude Code. It handles dependencies, container setup, and service config automatically.</p>
                </div>
              ),
            },
            {
              title: 'Add HumanPages MCP server',
              detail: (
                <div>
                  <p className="mb-2">Add to <code>.mcp.json</code> in the agent directory:</p>
                  <CodeBlock code={MCP_JSON} lang="json" filename=".mcp.json" />
                </div>
              ),
            },
            {
              title: 'Add channels',
              detail: (
                <div>
                  <p className="mb-2">Connect messaging channels via built-in skills:</p>
                  <CodeBlock code={`/add-whatsapp\n/add-telegram\n/add-slack\n/add-discord\n/add-gmail`} lang="bash" filename="Inside Claude Code" />
                </div>
              ),
            },
            {
              title: 'Use via any connected channel',
              detail: <p>Your NanoClaw agent can now search for and hire humans from WhatsApp, Telegram, Slack, Discord, or Gmail — wherever it's connected.</p>,
            },
          ]}
        />
      </Section>

      <Section title="Why NanoClaw + HumanPages">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
            <p className="font-semibold text-indigo-900 mb-1">Container isolation</p>
            <p className="text-sm text-indigo-700">Every agent runs in a Docker Sandbox VM or Apple Container — MCP tools can't touch your host filesystem.</p>
          </div>
          <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
            <p className="font-semibold text-indigo-900 mb-1">Multi-channel</p>
            <p className="text-sm text-indigo-700">Hire humans from WhatsApp, Telegram, Slack, Discord, or Gmail — all through one agent.</p>
          </div>
          <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
            <p className="font-semibold text-indigo-900 mb-1">Standard MCP config</p>
            <p className="text-sm text-indigo-700">Uses the standard <code>.mcp.json</code> format — same config structure as Claude Code and Cursor.</p>
          </div>
          <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
            <p className="font-semibold text-indigo-900 mb-1">Scheduled tasks</p>
            <p className="text-sm text-indigo-700">Built-in task scheduling — set up recurring hiring workflows that run on autopilot.</p>
          </div>
        </div>
      </Section>

      <ToolsReference />
      <TryItSection />
      <RelatedPlatforms currentSlug="nanoclaw" slugs={['zeroclaw', 'trustclaw', 'clawhub', 'nanobot']} />
      <PlatformNav currentSlug="nanoclaw" />
    </ConnectLayout>
  );
}
