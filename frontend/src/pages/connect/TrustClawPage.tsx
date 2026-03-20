import ConnectLayout from './ConnectLayout';
import { StepByStep, Section, Callout, PlatformHero, TryItSection, ToolsReference, PlatformNav, RelatedPlatforms } from './shared';

export default function TrustClawPage() {
  return (
    <ConnectLayout
      title="Connect HumanPages to TrustClaw"
      description="Add HumanPages MCP to TrustClaw — secure cloud-sandboxed AI agent execution by Composio. No local setup, no risk to your dev machine."
      path="/dev/connect/trustclaw"
      breadcrumbs={[{ label: 'Connect', href: '/dev/connect' }, { label: 'TrustClaw' }]}
    >
      <PlatformHero
        gradient="from-emerald-50 to-green-50"
        icon={<span>🛡️</span>}
        name="TrustClaw"
        tagline="Cloud-sandboxed agent execution — 1,000+ pre-installed tools"
        docsUrl="https://trustclaw.app"
      />

      <Callout type="info">
        TrustClaw is built by the Composio team as a security-focused agent platform. All execution happens in isolated cloud environments — nothing runs on your local machine.
      </Callout>

      <Section title="Setup (UI-based)">
        <StepByStep
          steps={[
            {
              title: 'Sign up at TrustClaw',
              detail: <p>Go to <a href="https://trustclaw.app" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">trustclaw.app</a> and create an account or sign in.</p>,
            },
            {
              title: 'Create or open an agent',
              detail: <p>Create a new agent from the dashboard, or open an existing one.</p>,
            },
            {
              title: 'Add HumanPages as an MCP connection',
              detail: (
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 space-y-2">
                  <div><strong className="text-slate-700">MCP Server URL:</strong> <code>https://mcp.humanpages.ai/mcp</code></div>
                  <div><strong className="text-slate-700">Auth:</strong> None required</div>
                  <p className="text-sm text-slate-500 mt-2">TrustClaw's dashboard lets you add MCP connections through its tool configuration interface. Add the URL above as a remote MCP server.</p>
                </div>
              ),
            },
            {
              title: 'Deploy',
              detail: <p>TrustClaw handles the infrastructure — your agent runs in a managed cloud sandbox with the HumanPages tools available.</p>,
            },
          ]}
        />
      </Section>

      <Section title="Why TrustClaw + HumanPages">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
            <p className="font-semibold text-emerald-900 mb-1">Cloud sandbox</p>
            <p className="text-sm text-emerald-700">Agent actions are fully isolated — no risk of accidental file deletion or credential exposure on your machine.</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
            <p className="font-semibold text-emerald-900 mb-1">1,000+ tools via OAuth</p>
            <p className="text-sm text-emerald-700">Pre-integrated tools for Slack, GitHub, Google Workspace, and more — combine with HumanPages for rich workflows.</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
            <p className="font-semibold text-emerald-900 mb-1">Zero setup</p>
            <p className="text-sm text-emerald-700">No Docker, no Node.js, no local dependencies. Just point to the MCP URL and go.</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
            <p className="font-semibold text-emerald-900 mb-1">By Composio</p>
            <p className="text-sm text-emerald-700">Built by the team behind Composio — proven infrastructure for secure agent tool execution.</p>
          </div>
        </div>
      </Section>

      <ToolsReference />
      <TryItSection />
      <RelatedPlatforms currentSlug="trustclaw" slugs={['maxclaw', 'nanoclaw', 'clawhub', 'smithery']} />
      <PlatformNav currentSlug="trustclaw" />
    </ConnectLayout>
  );
}
