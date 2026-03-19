import ConnectLayout from './ConnectLayout';
import { CodeBlock, StepByStep, Section, Callout, PlatformHero, TryItSection, ToolsReference, PlatformNav, RelatedPlatforms } from './shared';

const INSTALL_CLAUDE = `npx @smithery/cli install humanpages --client claude`;
const INSTALL_CURSOR = `npx @smithery/cli install humanpages --client cursor`;

const SEARCH = `# Search for HumanPages on Smithery
npx @smithery/cli search humanpages`;

const ADD_REMOTE = `# Or add directly via MCP URL
smithery mcp add https://mcp.humanpages.ai/sse`;

export default function SmitheryPage() {
  return (
    <ConnectLayout
      title="Connect HumanPages via Smithery"
      description="Install HumanPages MCP from the Smithery registry — the largest third-party MCP server directory with a CLI that auto-configures your client."
      path="/dev/connect/smithery"
      breadcrumbs={[{ label: 'Connect', href: '/dev/connect' }, { label: 'Smithery' }]}
    >
      <PlatformHero
        gradient="from-sky-50 to-blue-50"
        icon={<span>🔨</span>}
        name="Smithery"
        tagline="The largest MCP server registry — CLI installs to any client"
        docsUrl="https://smithery.ai/docs/concepts/cli"
      />

      <Section title="Install via Smithery CLI">
        <StepByStep
          steps={[
            {
              title: 'Install for Claude Desktop',
              detail: (
                <CodeBlock code={INSTALL_CLAUDE} lang="bash" filename="Terminal" />
              ),
            },
            {
              title: 'Or install for Cursor',
              detail: (
                <CodeBlock code={INSTALL_CURSOR} lang="bash" filename="Terminal" />
              ),
            },
            {
              title: 'That\'s it',
              detail: <p>Smithery auto-configures the right config file for your chosen client. Restart the client and HumanPages tools are ready.</p>,
            },
          ]}
        />
      </Section>

      <Section title="Other CLI commands">
        <div className="space-y-3">
          <CodeBlock code={SEARCH} lang="bash" filename="Search" />
          <CodeBlock code={ADD_REMOTE} lang="bash" filename="Add by URL" />
          <CodeBlock code="smithery mcp list" lang="bash" filename="List installed" />
        </div>
      </Section>

      <Callout type="tip">
        Smithery supports <strong>multiple clients</strong> — install once and it configures the right config file automatically. Supported clients include Claude Desktop, Cursor, Windsurf, and more.
      </Callout>

      <Section title="Why use Smithery">
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="bg-sky-50 rounded-lg p-4 border border-sky-100">
            <p className="font-semibold text-sky-900 mb-1">Auto-config</p>
            <p className="text-sm text-sky-700">One command writes the correct JSON config for whatever MCP client you use.</p>
          </div>
          <div className="bg-sky-50 rounded-lg p-4 border border-sky-100">
            <p className="font-semibold text-sky-900 mb-1">Discovery</p>
            <p className="text-sm text-sky-700">Browse thousands of MCP servers. Combine HumanPages with other tools easily.</p>
          </div>
          <div className="bg-sky-50 rounded-lg p-4 border border-sky-100">
            <p className="font-semibold text-sky-900 mb-1">Client-agnostic</p>
            <p className="text-sm text-sky-700">Switch between Claude, Cursor, Windsurf — Smithery handles the config differences.</p>
          </div>
        </div>
      </Section>

      <ToolsReference />
      <TryItSection />
      <RelatedPlatforms currentSlug="smithery" slugs={['claude', 'cursor', 'windsurf', 'clawhub']} />
      <PlatformNav currentSlug="smithery" />
    </ConnectLayout>
  );
}
