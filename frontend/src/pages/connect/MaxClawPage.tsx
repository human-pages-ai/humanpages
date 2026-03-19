import ConnectLayout from './ConnectLayout';
import { StepByStep, Section, Callout, PlatformHero, TryItSection, ToolsReference, PlatformNav, RelatedPlatforms } from './shared';

export default function MaxClawPage() {
  return (
    <ConnectLayout
      title="Connect HumanPages to MaxClaw"
      description="Add HumanPages MCP to MaxClaw — MiniMax's cloud-hosted AI agent platform. Deploy a hiring agent in 10 seconds, no setup required."
      path="/dev/connect/maxclaw"
      breadcrumbs={[{ label: 'Connect', href: '/dev/connect' }, { label: 'MaxClaw' }]}
    >
      <PlatformHero
        gradient="from-violet-50 to-purple-50"
        icon={<span>🚀</span>}
        name="MaxClaw"
        tagline="MiniMax's cloud-hosted agent platform — deploy in 10 seconds"
        docsUrl="https://maxclaw.ai"
      />

      <Callout type="info">
        MaxClaw is fully managed by MiniMax — no server setup, Docker, or API key management. Add MCP connections through the dashboard.
      </Callout>

      <Section title="Setup (UI-based)">
        <StepByStep
          steps={[
            {
              title: 'Open the MiniMax Agent Platform',
              detail: <p>Go to <a href="https://maxclaw.ai" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">maxclaw.ai</a> and sign in or create an account.</p>,
            },
            {
              title: 'Create or open an agent',
              detail: <p>Click <strong>Create Agent</strong> or open an existing one. MaxClaw deploys agents in under 10 seconds.</p>,
            },
            {
              title: 'Add HumanPages as an MCP connection',
              detail: (
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 space-y-2">
                  <div><strong className="text-slate-700">MCP Server URL:</strong> <code>https://mcp.humanpages.ai/sse</code></div>
                  <div><strong className="text-slate-700">Transport:</strong> SSE</div>
                  <div><strong className="text-slate-700">Auth:</strong> None</div>
                </div>
              ),
            },
            {
              title: 'Start using',
              detail: <p>Your MaxClaw agent now has access to HumanPages tools — search for humans, browse listings, and create jobs from any connected chat channel.</p>,
            },
          ]}
        />
      </Section>

      <Section title="Why MaxClaw + HumanPages">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-violet-50 rounded-lg p-4 border border-violet-100">
            <p className="font-semibold text-violet-900 mb-1">Zero infrastructure</p>
            <p className="text-sm text-violet-700">No Docker, no Node.js, no servers. MaxClaw runs everything in MiniMax's cloud.</p>
          </div>
          <div className="bg-violet-50 rounded-lg p-4 border border-violet-100">
            <p className="font-semibold text-violet-900 mb-1">Always-on</p>
            <p className="text-sm text-violet-700">Your hiring agent runs 24/7 — it doesn't stop when you close your laptop.</p>
          </div>
          <div className="bg-violet-50 rounded-lg p-4 border border-violet-100">
            <p className="font-semibold text-violet-900 mb-1">200K+ token memory</p>
            <p className="text-sm text-violet-700">Persistent long-term memory means your agent remembers past hiring decisions and preferences.</p>
          </div>
          <div className="bg-violet-50 rounded-lg p-4 border border-violet-100">
            <p className="font-semibold text-violet-900 mb-1">Free tier</p>
            <p className="text-sm text-violet-700">Get started with free daily credits — no credit card required for testing.</p>
          </div>
        </div>
      </Section>

      <ToolsReference />
      <TryItSection />
      <RelatedPlatforms currentSlug="maxclaw" slugs={['trustclaw', 'chatgpt', 'clawhub', 'smithery']} />
      <PlatformNav currentSlug="maxclaw" />
    </ConnectLayout>
  );
}
