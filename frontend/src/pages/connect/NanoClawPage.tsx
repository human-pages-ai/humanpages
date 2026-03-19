import ConnectLayout from './ConnectLayout';
import { CodeBlock, StepByStep, Section, Callout, PlatformHero, TryItSection, ToolsReference, PlatformNav, RelatedPlatforms } from './shared';

const MCP_CONFIG = `# In your NanoClaw agent's config, add HumanPages as an MCP server:
mcp_servers:
  humanpages:
    command: npx
    args: ["-y", "humanpages"]
    env:
      API_BASE_URL: https://humanpages.ai`;

const SKILL_ADD = `# Or add via Claude Code skill inside your NanoClaw container:
claude mcp add humanpages -- npx -y humanpages`;

export default function NanoClawPage() {
  return (
    <ConnectLayout
      title="Connect HumanPages to NanoClaw"
      description="Add HumanPages MCP to your NanoClaw agent. Hire real humans from a secure, containerized AI assistant connected to WhatsApp, Telegram, Slack, and more."
      path="/dev/connect/nanoclaw"
      breadcrumbs={[{ label: 'Connect', href: '/dev/connect' }, { label: 'NanoClaw' }]}
    >
      <PlatformHero
        gradient="from-indigo-50 to-blue-50"
        icon={<span>🐳</span>}
        name="NanoClaw"
        tagline="Secure containerized agents — built on Anthropic's Agent SDK"
        docsUrl="https://github.com/qwibitai/nanoclaw"
      />

      <Callout type="info">
        NanoClaw runs each agent in its own Docker/Apple Container sandbox. MCP servers you add run <strong>inside</strong> the container — isolated from your host system.
      </Callout>

      <Section title="Setup">
        <StepByStep
          steps={[
            {
              title: 'Install NanoClaw',
              detail: (
                <div>
                  <CodeBlock code={`git clone https://github.com/qwibitai/nanoclaw.git\ncd nanoclaw\nclaude\n/setup`} lang="bash" filename="Terminal" />
                  <p className="text-sm text-slate-500 mt-2">Claude Code handles dependencies, auth, container setup, and service config automatically.</p>
                </div>
              ),
            },
            {
              title: 'Add HumanPages MCP server',
              detail: (
                <div>
                  <p className="mb-2">Add to your agent's MCP config:</p>
                  <CodeBlock code={MCP_CONFIG} lang="yaml" filename="agent config" />
                </div>
              ),
            },
            {
              title: 'Or add via Claude Code skill',
              detail: (
                <div>
                  <CodeBlock code={SKILL_ADD} lang="bash" filename="Inside NanoClaw container" />
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
            <p className="text-sm text-indigo-700">Every agent runs in a sandboxed container — MCP tools can't touch your host filesystem.</p>
          </div>
          <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
            <p className="font-semibold text-indigo-900 mb-1">Multi-channel</p>
            <p className="text-sm text-indigo-700">Hire humans from WhatsApp, Telegram, Slack, or Discord — all through one agent.</p>
          </div>
          <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
            <p className="font-semibold text-indigo-900 mb-1">Portable skills</p>
            <p className="text-sm text-indigo-700">MCP servers are Layer 3 — they travel with you if you switch agent frameworks.</p>
          </div>
          <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
            <p className="font-semibold text-indigo-900 mb-1">Anthropic Agent SDK</p>
            <p className="text-sm text-indigo-700">Built on the same SDK as Claude Code — first-class MCP support out of the box.</p>
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
