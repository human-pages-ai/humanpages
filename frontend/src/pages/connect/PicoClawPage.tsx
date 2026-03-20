import ConnectLayout from './ConnectLayout';
import { CodeBlock, StepByStep, Section, Callout, PlatformHero, TryItSection, ToolsReference, PlatformNav, RelatedPlatforms } from './shared';

const CONFIG_JSON = `// ~/.picoclaw/config.json — add HumanPages under tools.mcp
{
  "tools": {
    "mcp": {
      "enabled": true,
      "servers": {
        "humanpages": {
          "enabled": true,
          "command": "npx",
          "args": ["-y", "humanpages"]
        }
      }
    }
  }
}`;

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
        tagline="<10 MB RAM, runs anywhere — from Raspberry Pi to $10 hardware"
        docsUrl="https://github.com/sipeed/picoclaw"
      />

      <Callout type="info">
        PicoClaw supports ARM, RISC-V, MIPS, and x86 architectures. A single binary that runs on virtually any hardware.
      </Callout>

      <Section title="Setup">
        <StepByStep
          steps={[
            {
              title: 'Install PicoClaw',
              detail: (
                <div>
                  <CodeBlock code={`# Pre-built binaries for ARM, x86, RISC-V, MIPS, LoongArch\ncurl -fsSL https://picoclaw.net/install.sh | sh\n\n# Then run onboarding\npicoclaw onboard`} lang="bash" filename="Terminal" />
                  <p className="text-sm text-slate-500 mt-2">This generates <code>~/.picoclaw/config.json</code> with your initial configuration.</p>
                </div>
              ),
            },
            {
              title: 'Add HumanPages MCP',
              detail: (
                <div>
                  <p className="mb-2">Add to the <code>tools.mcp.servers</code> section in <code>~/.picoclaw/config.json</code>:</p>
                  <CodeBlock code={CONFIG_JSON} lang="json" filename="~/.picoclaw/config.json" />
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
            <p className="font-semibold text-yellow-900 mb-1">Multi-channel</p>
            <p className="text-sm text-yellow-700">Connect via Telegram, Discord, Slack, QQ, DingTalk, WeCom, LINE, Matrix, or IRC.</p>
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
            <p className="text-2xl font-bold text-amber-900">6 archs</p>
            <p className="text-xs text-amber-600 mt-1">ARM, RISC-V, MIPS, x86, LoongArch</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-100 text-center">
            <p className="text-2xl font-bold text-amber-900">Go</p>
            <p className="text-xs text-amber-600 mt-1">Single binary, zero deps</p>
          </div>
        </div>
      </Section>

      <ToolsReference />
      <TryItSection />
      <RelatedPlatforms currentSlug="picoclaw" slugs={['zeroclaw', 'nanoclaw', 'trustclaw', 'clawhub']} />
      <PlatformNav currentSlug="picoclaw" />
    </ConnectLayout>
  );
}
