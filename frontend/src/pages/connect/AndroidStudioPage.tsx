import ConnectLayout from './ConnectLayout';
import { CodeBlock, StepByStep, Section, Callout, PlatformHero, TryItSection, ToolsReference, PlatformNav, RelatedPlatforms } from './shared';

const MCP_CONFIG = `{
  "mcpServers": {
    "humanpages": {
      "command": "npx",
      "args": ["-y", "humanpages"],
      "env": {
        "API_BASE_URL": "https://humanpages.ai"
      }
    }
  }
}`;

export default function AndroidStudioPage() {
  return (
    <ConnectLayout
      title="Connect HumanPages to Android Studio"
      description="Add HumanPages MCP to Android Studio's Gemini integration. Hire testers, designers, and translators for your Android app — from inside your IDE."
      path="/dev/connect/android-studio"
      breadcrumbs={[{ label: 'Connect', href: '/dev/connect' }, { label: 'Android Studio' }]}
      ogPlatform="android-studio"
    >
      <PlatformHero
        gradient="from-green-50 to-lime-50"
        icon={<span>📱</span>}
        name="Android Studio (Gemini)"
        tagline="MCP tools in Gemini's Agent Mode for Android devs"
        docsUrl="https://developer.android.com/studio/gemini/add-mcp-server"
      />

      <Section title="Setup">
        <StepByStep
          steps={[
            {
              title: 'Enable MCP Servers',
              detail: <p>Open <strong>File → Settings</strong> (or <strong>Android Studio → Settings</strong> on macOS) → <strong>Tools → AI → MCP Servers</strong> → check <strong>Enable MCP Servers</strong>.</p>,
            },
            {
              title: 'Add server configuration',
              detail: (
                <div>
                  <p className="mb-2">Add the HumanPages MCP server config:</p>
                  <CodeBlock code={MCP_CONFIG} lang="json" filename="MCP Server Configuration" />
                </div>
              ),
            },
            {
              title: 'Use in Agent Mode',
              detail: <p>Open the Gemini panel and switch to <strong>Agent Mode</strong>. The HumanPages tools will appear when the agent needs to search for or hire humans.</p>,
            },
          ]}
        />
      </Section>

      <Section title="Great for Android teams">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-green-50 rounded-lg p-4 border border-green-100">
            <p className="font-semibold text-green-900 mb-1">QA Testers</p>
            <p className="text-sm text-green-700">Find real device testers for your Android app — including Google Play's 14-day closed testing requirement.</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 border border-green-100">
            <p className="font-semibold text-green-900 mb-1">Localization</p>
            <p className="text-sm text-green-700">Hire native speakers to review your strings.xml translations in context.</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 border border-green-100">
            <p className="font-semibold text-green-900 mb-1">Design Review</p>
            <p className="text-sm text-green-700">Get Material Design feedback from real UI/UX designers.</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 border border-green-100">
            <p className="font-semibold text-green-900 mb-1">Beta Feedback</p>
            <p className="text-sm text-green-700">Recruit real users for beta testing and structured feedback.</p>
          </div>
        </div>
      </Section>

      <Callout type="info">
        Android Studio's MCP integration uses <strong>stdio transport</strong> (local npx). Remote HTTP support is available for some servers — check Android Studio release notes for the latest.
      </Callout>

      <ToolsReference />
      <TryItSection />
      <RelatedPlatforms currentSlug="android-studio" slugs={['gemini', 'claude', 'cursor', 'smithery']} />
      <PlatformNav currentSlug="android-studio" />
    </ConnectLayout>
  );
}
