import ConnectLayout from './ConnectLayout';
import { CodeBlock, StepByStep, Section, Callout, PlatformHero, TryItSection, ToolsReference, PlatformNav, RelatedPlatforms } from './shared';

const OPENCLAW_INSTALL = `# Install the OpenClaw CLI
npm install -g openclaw

# Add HumanPages as a skill
openclaw add humanpages`;

const OPENCLAW_CONFIG = `// openclaw.config.json — OpenClaw project configuration
{
  "skills": {
    "humanpages": {
      "version": "latest",
      "transport": "stdio"
    }
  },
  "agent": {
    "model": "claude-sonnet-4-20250514",
    "systemPrompt": "You are a hiring assistant with access to real human workers."
  }
}`;

export default function OpenClawPage() {
  return (
    <ConnectLayout
      title="Connect HumanPages to OpenClaw"
      description="Add real human-hiring capabilities to any OpenClaw-powered agent. OpenClaw is the open ecosystem that powers ClawHub, NanoClaw, ZeroClaw, TrustClaw, PicoClaw, and MaxClaw."
      path="/dev/connect/openclaw"
      breadcrumbs={[{ label: 'Connect', href: '/dev/connect' }, { label: 'OpenClaw' }]}
      ogPlatform="openclaw"
    >
      <PlatformHero
        gradient="from-red-50 to-rose-50"
        icon={<span>🦞</span>}
        name="OpenClaw"
        tagline="Open ecosystem for AI agent skills"
        docsUrl="https://openclaw.ai"
      />

      <Section title="Install via OpenClaw CLI">
        <StepByStep
          steps={[
            {
              title: 'Install the OpenClaw CLI',
              detail: (
                <CodeBlock code="npm install -g openclaw" lang="bash" filename="Terminal" />
              ),
            },
            {
              title: 'Add the HumanPages skill',
              detail: (
                <div>
                  <CodeBlock code={OPENCLAW_INSTALL} lang="bash" filename="Terminal" />
                  <p className="text-sm text-slate-500 mt-2">
                    This registers HumanPages as an OpenClaw skill and makes all MCP tools available to any compatible agent.
                  </p>
                </div>
              ),
            },
            {
              title: 'Configure your project (optional)',
              detail: (
                <div>
                  <p className="mb-2">Create an <code>openclaw.config.json</code> to pin versions and set defaults:</p>
                  <CodeBlock code={OPENCLAW_CONFIG} lang="json" filename="openclaw.config.json" />
                </div>
              ),
            },
            {
              title: 'Run your agent',
              detail: (
                <div>
                  <CodeBlock code={`openclaw run          # start agent with all configured skills\nopenclaw list         # see installed skills\nopenclaw update --all # update all skills`} lang="bash" filename="Terminal" />
                </div>
              ),
            },
          ]}
        />
      </Section>

      <Section title="The OpenClaw Ecosystem">
        <p className="text-slate-600 mb-4">
          OpenClaw is the open framework and specification that defines how AI agent skills are packaged, distributed, and executed. It powers an entire family of tools, each serving a different part of the ecosystem:
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-rose-50 rounded-lg p-4 border border-rose-100">
            <p className="font-semibold text-rose-900 mb-1">ClawHub</p>
            <p className="text-sm text-rose-700">The package registry — discover and install skills from 13,000+ published packages. Think npm for AI tools.</p>
          </div>
          <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
            <p className="font-semibold text-indigo-900 mb-1">NanoClaw</p>
            <p className="text-sm text-indigo-700">Secure containerized agents with Docker Sandbox isolation and multi-channel messaging (WhatsApp, Telegram, Slack).</p>
          </div>
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-100">
            <p className="font-semibold text-orange-900 mb-1">ZeroClaw</p>
            <p className="text-sm text-orange-700">Ultra-lightweight Rust runtime at 3 MB — runs on Raspberry Pi and edge devices.</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
            <p className="font-semibold text-emerald-900 mb-1">TrustClaw</p>
            <p className="text-sm text-emerald-700">Managed cloud sandbox — zero local setup, zero local risk. Deploy agents in seconds.</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-100">
            <p className="font-semibold text-yellow-900 mb-1">PicoClaw</p>
            <p className="text-sm text-yellow-700">IoT and embedded agent runtime in Go — runs on 10 MB RAM for edge and embedded systems.</p>
          </div>
          <div className="bg-violet-50 rounded-lg p-4 border border-violet-100">
            <p className="font-semibold text-violet-900 mb-1">MaxClaw</p>
            <p className="text-sm text-violet-700">Fully managed cloud agent by MiniMax — deploy in 10 seconds, always-on, free credits to start.</p>
          </div>
        </div>
      </Section>

      <Section title="How HumanPages Fits In">
        <p className="text-slate-600 mb-4">
          When you add HumanPages as an OpenClaw skill, any agent running on <em>any</em> OpenClaw-compatible runtime gets access to real human workers. Whether your agent runs in a NanoClaw container, on a ZeroClaw edge device, or in the TrustClaw cloud — the same MCP tools work everywhere.
        </p>
        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
          <p className="font-mono text-sm text-slate-600">
            Agent prompt → OpenClaw skill (HumanPages) → MCP tools → search_humans, create_listing, create_job_offer → Real humans get hired
          </p>
        </div>
      </Section>

      <Callout type="tip">
        If you're using a specific OpenClaw runtime (NanoClaw, ZeroClaw, etc.), check their dedicated setup pages for runtime-specific instructions. This page covers the base OpenClaw CLI setup.
      </Callout>

      <ToolsReference />
      <TryItSection />
      <RelatedPlatforms currentSlug="openclaw" slugs={['clawhub', 'nanoclaw', 'zeroclaw', 'trustclaw', 'picoclaw', 'maxclaw']} />
      <PlatformNav currentSlug="openclaw" />
    </ConnectLayout>
  );
}
