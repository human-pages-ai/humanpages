import ConnectLayout from './ConnectLayout';
import { CodeBlock, StepByStep, Section, Callout, PlatformHero, TryItSection, ToolsReference } from './shared';

const TRUSTCLAW_CONFIG = `# TrustClaw agent config — add HumanPages MCP
mcp_servers:
  humanpages:
    url: https://mcp.humanpages.ai/sse
    transport: sse`;

export default function TrustClawPage() {
  return (
    <ConnectLayout
      title="Connect HumanPages to TrustClaw"
      description="Add HumanPages MCP to TrustClaw — secure cloud-sandboxed AI agent execution. No local setup, no risk to your dev machine."
      path="/dev/connect/trustclaw"
      breadcrumbs={[{ label: 'Connect', href: '/dev/connect' }, { label: 'TrustClaw' }]}
    >
      <PlatformHero
        gradient="from-emerald-50 to-green-50"
        icon={<span>🛡️</span>}
        name="TrustClaw"
        tagline="Cloud-sandboxed agent execution — zero local risk"
        docsUrl="https://trustclaw.com"
      />

      <Callout type="info">
        TrustClaw runs all agent actions in sandboxed cloud environments. Your agent connects to HumanPages MCP without anything running on your local machine.
      </Callout>

      <Section title="Setup">
        <StepByStep
          steps={[
            {
              title: 'Create or open your TrustClaw agent',
              detail: <p>Sign up at TrustClaw and create a new agent, or open an existing one in the dashboard.</p>,
            },
            {
              title: 'Add HumanPages as an MCP server',
              detail: (
                <div>
                  <p className="mb-2">In your agent's configuration, add the HumanPages MCP endpoint:</p>
                  <CodeBlock code={TRUSTCLAW_CONFIG} lang="yaml" filename="Agent config" />
                </div>
              ),
            },
            {
              title: 'Deploy',
              detail: <p>TrustClaw handles the infrastructure — your agent runs in a managed sandbox with the HumanPages tools available.</p>,
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
            <p className="font-semibold text-emerald-900 mb-1">Zero setup</p>
            <p className="text-sm text-emerald-700">No Docker, no Node.js, no local dependencies. Just point to the MCP URL and go.</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
            <p className="font-semibold text-emerald-900 mb-1">Managed infra</p>
            <p className="text-sm text-emerald-700">TrustClaw handles scaling, uptime, and security — you focus on what your agent does.</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
            <p className="font-semibold text-emerald-900 mb-1">Pre-installed tools</p>
            <p className="text-sm text-emerald-700">Large library of pre-installed tools to combine with HumanPages for complex workflows.</p>
          </div>
        </div>
      </Section>

      <ToolsReference />
      <TryItSection />
    </ConnectLayout>
  );
}
