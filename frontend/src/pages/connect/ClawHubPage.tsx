import ConnectLayout from './ConnectLayout';
import { CodeBlock, StepByStep, Section, Callout, PlatformHero, TryItSection, ToolsReference, PlatformNav, RelatedPlatforms } from './shared';

const CLAWHUB_INSTALL = `clawhub install humanpages`;

const CLAWHUB_CONFIG = `# Or add directly to your .clawhub/config.yaml
skills:
  - name: humanpages
    source: clawhub.com/skills/humanpages
    env:
      API_BASE_URL: https://humanpages.ai`;

export default function ClawHubPage() {
  return (
    <ConnectLayout
      title="Connect HumanPages via ClawHub (OpenClaw)"
      description="Install HumanPages as an OpenClaw skill via ClawHub. One command to add real human-hiring capabilities to your AI agent."
      path="/dev/connect/clawhub"
      breadcrumbs={[{ label: 'Connect', href: '/dev/connect' }, { label: 'ClawHub' }]}
    >
      <PlatformHero
        gradient="from-rose-50 to-pink-50"
        icon={<span>🦞</span>}
        name="ClawHub (OpenClaw)"
        tagline="Install as an OpenClaw skill — one command"
        docsUrl="https://clawhub.com/skills/humanpages"
      />

      <Section title="Install via ClawHub CLI">
        <StepByStep
          steps={[
            {
              title: 'Install ClawHub (if needed)',
              detail: (
                <CodeBlock code="npm install -g clawhub" lang="bash" filename="Terminal" />
              ),
            },
            {
              title: 'Install the HumanPages skill',
              detail: (
                <div>
                  <CodeBlock code={CLAWHUB_INSTALL} lang="bash" filename="Terminal" />
                  <p className="text-sm text-slate-500 mt-2">
                    This installs HumanPages as an OpenClaw skill and registers all MCP tools automatically.
                  </p>
                </div>
              ),
            },
            {
              title: 'Start using it',
              detail: <p>The HumanPages tools are now available to any OpenClaw-compatible agent in your environment.</p>,
            },
          ]}
        />
      </Section>

      <Section title="Manual config (alternative)">
        <p className="text-slate-600 mb-4">
          You can also add it directly to your ClawHub config file:
        </p>
        <CodeBlock code={CLAWHUB_CONFIG} lang="yaml" filename=".clawhub/config.yaml" />
      </Section>

      <Section title="What is OpenClaw?">
        <p className="text-slate-600">
          OpenClaw is an open ecosystem for distributing AI agent skills. ClawHub is its package registry — think npm for AI tools. When you install HumanPages as a ClawHub skill, it exposes the same MCP tools (search_humans, create_listing, etc.) through the OpenClaw interface, making them available to any compatible agent framework.
        </p>
      </Section>

      <Callout type="tip">
        Already using another MCP client like Claude or Cursor? You don't need ClawHub — it's an alternative distribution channel. Use whichever method fits your setup.
      </Callout>

      <ToolsReference />
      <TryItSection />
      <RelatedPlatforms currentSlug="clawhub" slugs={['smithery', 'nanoclaw', 'zeroclaw', 'nanobot']} />
      <PlatformNav currentSlug="clawhub" />
    </ConnectLayout>
  );
}
