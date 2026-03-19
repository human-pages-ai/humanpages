import ConnectLayout from './ConnectLayout';
import { CodeBlock, StepByStep, Section, Callout, PlatformHero, TryItSection, ToolsReference } from './shared';

const CONFIG = `# picoclaw.yaml — add HumanPages MCP
mcp:
  humanpages:
    url: https://mcp.humanpages.ai/sse
    transport: sse`;

export default function PicoClawPage() {
  return (
    <ConnectLayout
      title="Connect HumanPages to PicoClaw"
      description="Add HumanPages MCP to PicoClaw — the ultra-lightweight AI assistant for IoT devices, Raspberry Pi, and resource-constrained hardware."
      path="/dev/connect/picoclaw"
      breadcrumbs={[{ label: 'Connect', href: '/dev/connect' }, { label: 'PicoClaw' }]}
    >
      <PlatformHero
        gradient="from-yellow-50 to-amber-50"
        icon={<span>🤏</span>}
        name="PicoClaw"
        tagline="10 MB of RAM, runs anywhere — from Raspberry Pi to $10 hardware"
        docsUrl="https://github.com/sipeed/picoclaw"
      />

      <Callout type="info">
        PicoClaw added native MCP support in v0.2.1 (March 2026). Make sure you're on the latest version for full compatibility.
      </Callout>

      <Section title="Setup">
        <StepByStep
          steps={[
            {
              title: 'Install PicoClaw',
              detail: (
                <CodeBlock code={`# Pre-built binaries for ARM, x86, RISC-V\ncurl -fsSL https://picoclaw.net/install.sh | sh\n\n# Or build from source\ngo install github.com/sipeed/picoclaw@latest`} lang="bash" filename="Terminal" />
              ),
            },
            {
              title: 'Add HumanPages MCP',
              detail: (
                <div>
                  <p className="mb-2">Add to your PicoClaw config:</p>
                  <CodeBlock code={CONFIG} lang="yaml" filename="picoclaw.yaml" />
                </div>
              ),
            },
            {
              title: 'Run',
              detail: (
                <CodeBlock code="picoclaw start" lang="bash" filename="Terminal" />
              ),
            },
          ]}
        />
      </Section>

      <Section title="Edge + HumanPages use cases">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-100">
            <p className="font-semibold text-yellow-900 mb-1">IoT monitoring agent</p>
            <p className="text-sm text-yellow-700">Run on a Pi that monitors sensors — when anomalies hit, automatically hire a human technician via HumanPages.</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-100">
            <p className="font-semibold text-yellow-900 mb-1">Kiosk assistant</p>
            <p className="text-sm text-yellow-700">Deploy on low-cost hardware as a customer-facing agent that can escalate to real human support.</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-100">
            <p className="font-semibold text-yellow-900 mb-1">Home automation</p>
            <p className="text-sm text-yellow-700">Smart home agent that can hire people for physical tasks — cleaning, repairs, delivery.</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-100">
            <p className="font-semibold text-yellow-900 mb-1">Offline-first</p>
            <p className="text-sm text-yellow-700">Queue hiring requests when offline, execute them when connectivity returns.</p>
          </div>
        </div>
      </Section>

      <Section title="Specs">
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-100 text-center">
            <p className="text-2xl font-bold text-amber-900">&lt;10 MB</p>
            <p className="text-xs text-amber-600 mt-1">RAM usage</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-100 text-center">
            <p className="text-2xl font-bold text-amber-900">ARM + x86</p>
            <p className="text-xs text-amber-600 mt-1">Multi-architecture</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-100 text-center">
            <p className="text-2xl font-bold text-amber-900">Go</p>
            <p className="text-xs text-amber-600 mt-1">Single binary, zero deps</p>
          </div>
        </div>
      </Section>

      <ToolsReference />
      <TryItSection />
    </ConnectLayout>
  );
}
