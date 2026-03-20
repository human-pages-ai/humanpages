import ConnectLayout from './ConnectLayout';
import { StepByStep, Section, Callout, PlatformHero, TryItSection, ToolsReference, PlatformNav, RelatedPlatforms } from './shared';

export default function MaxClawPage() {
  return (
    <ConnectLayout
      title="Connect HumanPages to MaxClaw"
      description="Add HumanPages MCP to MaxClaw — MiniMax's cloud-hosted AI agent platform. Deploy a hiring agent in seconds, no setup required."
      path="/dev/connect/maxclaw"
      breadcrumbs={[{ label: 'Connect', href: '/dev/connect' }, { label: 'MaxClaw' }]}
      ogPlatform="maxclaw"
    >
      <PlatformHero
        gradient="from-violet-50 to-purple-50"
        icon={<span>🚀</span>}
        name="MaxClaw"
        tagline="MiniMax's cloud-hosted agent platform — deploy in seconds"
        docsUrl="https://maxclaw.ai"
      />

      <Callout type="info">
        MaxClaw is fully managed by MiniMax — no server setup, Docker, or API key management. Configure MCP connections through the Expert 2.0 interface using natural language.
      </Callout>

      <Section title="Setup (UI-based)">
        <StepByStep
          steps={[
            {
              title: 'Open MaxClaw',
              detail: <p>Go to <a href="https://maxclaw.ai" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">maxclaw.ai</a> (or <a href="https://agent.minimax.io/max-claw" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">agent.minimax.io/max-claw</a>) and sign in or create an account.</p>,
            },
            {
              title: 'Create or open an agent',
              detail: <p>Use the Expert 2.0 interface to create a new agent. You can describe what you want in natural language.</p>,
            },
            {
              title: 'Add HumanPages as an MCP connection',
              detail: (
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 space-y-2">
                  <div><strong className="text-slate-700">MCP Server URL:</strong> <code>https://mcp.humanpages.ai/mcp</code></div>
                  <div><strong className="text-slate-700">Auth:</strong> None required</div>
                  <p className="text-sm text-slate-500 mt-2">MaxClaw's Expert 2.0 interface can auto-configure MCP connections. You can also add the URL manually in the tool configuration panel.</p>
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
            <p className="font-semibold text-violet-900 mb-1">Natural language config</p>
            <p className="text-sm text-violet-700">Expert 2.0 lets you describe your agent in plain English — it handles MCP wiring automatically.</p>
          </div>
          <div className="bg-violet-50 rounded-lg p-4 border border-violet-100">
            <p className="font-semibold text-violet-900 mb-1">By MiniMax</p>
            <p className="text-sm text-violet-700">Backed by MiniMax — enterprise-grade infrastructure with a generous free tier.</p>
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
