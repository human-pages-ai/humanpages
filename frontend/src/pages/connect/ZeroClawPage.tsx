import ConnectLayout from './ConnectLayout';
import { CodeBlock, StepByStep, Section, Callout, PlatformHero, TryItSection, ToolsReference, PlatformNav, RelatedPlatforms } from './shared';

const CONFIG_TOML = `# ~/.zeroclaw/config.toml — add HumanPages as an MCP server
[mcp_servers.humanpages]
command = "npx"
args = ["-y", "humanpages"]`;

const CONFIG_REMOTE = `# Or use remote HTTP transport
[mcp_servers.humanpages]
url = "https://mcp.humanpages.ai/mcp"`;

export default function ZeroClawPage() {
  return (
    <ConnectLayout
      title="Connect HumanPages to ZeroClaw"
      description="Add HumanPages MCP to ZeroClaw — the ultra-lightweight Rust-based agent runtime for edge devices and self-hosted systems."
      path="/dev/connect/zeroclaw"
      breadcrumbs={[{ label: 'Connect', href: '/dev/connect' }, { label: 'ZeroClaw' }]}
    >
      <PlatformHero
        gradient="from-orange-50 to-red-50"
        icon={<span>🦀</span>}
        name="ZeroClaw"
        tagline="Rust-based, ~9 MB binary, sub-10ms startup — MCP on the edge"
        docsUrl="https://github.com/zeroclaw-labs/zeroclaw"
      />

      <Section title="Setup">
        <StepByStep
          steps={[
            {
              title: 'Install ZeroClaw',
              detail: (
                <div>
                  <CodeBlock code={`# Download binary from GitHub releases\ncurl -fsSL https://zeroclaw.net/install.sh | sh\n\n# Then run onboarding to generate config\nzeroclaw onboard`} lang="bash" filename="Terminal" />
                  <p className="text-sm text-slate-500 mt-2">This creates <code>~/.zeroclaw/config.toml</code> with your provider keys and preferences.</p>
                </div>
              ),
            },
            {
              title: 'Add HumanPages MCP (local stdio)',
              detail: (
                <div>
                  <p className="mb-2">Add to your <code>~/.zeroclaw/config.toml</code>:</p>
                  <CodeBlock code={CONFIG_TOML} lang="toml" filename="~/.zeroclaw/config.toml" />
                </div>
              ),
            },
            {
              title: 'Or use remote transport',
              detail: (
                <CodeBlock code={CONFIG_REMOTE} lang="toml" filename="~/.zeroclaw/config.toml (remote)" />
              ),
            },
            {
              title: 'Run your agent',
              detail: (
                <CodeBlock code="zeroclaw run" lang="bash" filename="Terminal" />
              ),
            },
          ]}
        />
      </Section>

      <Section title="Why ZeroClaw + HumanPages">
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-100 text-center">
            <p className="text-2xl font-bold text-orange-900">~9 MB</p>
            <p className="text-xs text-orange-600 mt-1">Binary size — runs on Raspberry Pi</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-100 text-center">
            <p className="text-2xl font-bold text-orange-900">&lt;10 ms</p>
            <p className="text-xs text-orange-600 mt-1">Cold start — near-instant agent boot</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-100 text-center">
            <p className="text-2xl font-bold text-orange-900">22+</p>
            <p className="text-xs text-orange-600 mt-1">LLM providers — Claude, OpenAI, Ollama…</p>
          </div>
        </div>
      </Section>

      <Callout type="tip">
        ZeroClaw's Rust memory safety + sandbox controls make it a good fit for deploying hiring agents on shared infrastructure or edge devices where you can't afford a container runtime.
      </Callout>

      <ToolsReference />
      <TryItSection />
      <RelatedPlatforms currentSlug="zeroclaw" slugs={['nanoclaw', 'picoclaw', 'trustclaw', 'clawhub']} />
      <PlatformNav currentSlug="zeroclaw" />
    </ConnectLayout>
  );
}
