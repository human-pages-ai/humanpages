import ConnectLayout from './ConnectLayout';
import { CodeBlock, StepByStep, Section, Callout, PlatformHero, TryItSection, ToolsReference, PlatformNav, RelatedPlatforms } from './shared';

const CONFIG_TOML = `# zeroclaw.toml — add HumanPages as an MCP provider
[[mcp]]
name = "humanpages"
transport = "sse"
url = "https://mcp.humanpages.ai/sse"`;

const STDIO_CONFIG = `# Alternative: local stdio via npx
[[mcp]]
name = "humanpages"
transport = "stdio"
command = "npx"
args = ["-y", "humanpages"]

[mcp.env]
API_BASE_URL = "https://humanpages.ai"`;

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
        tagline="Rust-based, 3-5 MB binary, sub-10ms startup — MCP on the edge"
        docsUrl="https://github.com/zeroclaw-labs/zeroclaw"
      />

      <Section title="Setup">
        <StepByStep
          steps={[
            {
              title: 'Install ZeroClaw',
              detail: (
                <CodeBlock code={`cargo install zeroclaw\n# or download binary from GitHub releases`} lang="bash" filename="Terminal" />
              ),
            },
            {
              title: 'Add HumanPages MCP (remote)',
              detail: (
                <div>
                  <p className="mb-2">Add to your <code>zeroclaw.toml</code>:</p>
                  <CodeBlock code={CONFIG_TOML} lang="toml" filename="zeroclaw.toml" />
                </div>
              ),
            },
            {
              title: 'Or use local stdio',
              detail: (
                <CodeBlock code={STDIO_CONFIG} lang="toml" filename="zeroclaw.toml (local)" />
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
            <p className="text-2xl font-bold text-orange-900">3-5 MB</p>
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
