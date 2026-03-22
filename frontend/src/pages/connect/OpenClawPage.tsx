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
      description="Add real human-hiring capabilities to any OpenClaw-compatible agent. OpenClaw is the open specification for packaging and distributing AI agent skills."
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

      <Section title="What is OpenClaw?">
        <p className="text-slate-600 mb-4">
          OpenClaw is an open specification for packaging, distributing, and executing AI agent skills. Skills published to the OpenClaw format can be installed by any compatible runtime or registry.
        </p>
        <p className="text-slate-600 mb-4">
          When you add HumanPages as an OpenClaw skill, any compatible agent gets access to real human workers via MCP — search, hire, and pay people for real-world tasks.
        </p>
      </Section>

      <Callout type="tip">
        Several independent platforms support the OpenClaw spec. If you're using one of them, check their dedicated setup page for platform-specific instructions — this page covers the base OpenClaw CLI.
      </Callout>

      <ToolsReference />
      <TryItSection />
      <RelatedPlatforms currentSlug="openclaw" slugs={['clawhub', 'nanoclaw', 'zeroclaw', 'trustclaw', 'picoclaw', 'maxclaw']} />
      <PlatformNav currentSlug="openclaw" />
    </ConnectLayout>
  );
}
