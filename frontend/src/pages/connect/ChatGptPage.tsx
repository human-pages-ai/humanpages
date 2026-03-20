import ConnectLayout from './ConnectLayout';
import { StepByStep, Section, Callout, PlatformHero, TryItSection, ToolsReference, PlatformNav, RelatedPlatforms } from './shared';

export default function ChatGptPage() {
  return (
    <ConnectLayout
      title="Connect HumanPages to ChatGPT"
      description="Add HumanPages as an MCP connector in ChatGPT. Search and hire real humans from any ChatGPT conversation — no code needed."
      path="/dev/connect/chatgpt"
      breadcrumbs={[{ label: 'Connect', href: '/dev/connect' }, { label: 'ChatGPT' }]}
    >
      <PlatformHero
        gradient="from-green-50 to-emerald-50"
        icon={<span>💬</span>}
        name="ChatGPT"
        tagline="Full MCP support via Developer Mode — no code required"
        docsUrl="https://help.openai.com/en/articles/12584461-developer-mode-apps-and-full-mcp-connectors-in-chatgpt-beta"
      />

      <Callout type="info">
        Available on <strong>ChatGPT Plus, Pro, Business, Enterprise,</strong> and <strong>Education</strong> plans. Requires Developer Mode, which is free to enable.
      </Callout>

      <Section title="Setup (UI-based, no code)">
        <StepByStep
          steps={[
            {
              title: 'Enable Developer Mode',
              detail: <p>Open ChatGPT → click your avatar → <strong>Settings</strong> → <strong>Apps</strong> → <strong>Advanced settings</strong> → toggle <strong>Developer Mode</strong> on.</p>,
            },
            {
              title: 'Create a new connector',
              detail: <p>In any chat, click the <strong>tools icon</strong> (wrench/plug) in the message bar → <strong>Create connector</strong> (or go to Settings → Connectors → Create).</p>,
            },
            {
              title: 'Enter server details',
              detail: (
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 space-y-2">
                  <div><strong className="text-slate-700">Name:</strong> <code>HumanPages</code></div>
                  <div><strong className="text-slate-700">MCP Server URL:</strong> <code>https://mcp.humanpages.ai/mcp</code></div>
                  <div><strong className="text-slate-700">Authentication:</strong> None</div>
                </div>
              ),
            },
            {
              title: 'Save and use',
              detail: <p>Click <strong>Save</strong>. HumanPages tools now appear in the tools menu. Start a new chat and ask ChatGPT to search for humans.</p>,
            },
          ]}
        />
      </Section>

      {/* Visual: form mockup */}
      <Section title="What the form looks like">
        <div className="max-w-md mx-auto">
          <svg viewBox="0 0 400 320" className="w-full" aria-label="ChatGPT connector form mockup">
            <rect width="400" height="320" rx="16" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="1.5" />
            <text x="24" y="40" fill="#111827" fontSize="16" fontWeight="700">Create connector</text>

            {/* Name field */}
            <text x="24" y="74" fill="#6b7280" fontSize="11" fontWeight="500">Name</text>
            <rect x="24" y="80" width="352" height="36" rx="8" fill="white" stroke="#d1d5db" strokeWidth="1" />
            <text x="36" y="103" fill="#111827" fontSize="13">HumanPages</text>

            {/* URL field */}
            <text x="24" y="138" fill="#6b7280" fontSize="11" fontWeight="500">MCP Server URL</text>
            <rect x="24" y="144" width="352" height="36" rx="8" fill="white" stroke="#d1d5db" strokeWidth="1" />
            <text x="36" y="167" fill="#111827" fontSize="11" fontFamily="monospace">https://mcp.humanpages.ai/mcp</text>

            {/* Auth field */}
            <text x="24" y="202" fill="#6b7280" fontSize="11" fontWeight="500">Authentication</text>
            <rect x="24" y="208" width="352" height="36" rx="8" fill="white" stroke="#d1d5db" strokeWidth="1" />
            <text x="36" y="231" fill="#6b7280" fontSize="13">None</text>

            {/* Save button */}
            <rect x="24" y="268" width="352" height="36" rx="8" fill="#10a37f" />
            <text x="200" y="291" textAnchor="middle" fill="white" fontSize="14" fontWeight="600">Save</text>
          </svg>
        </div>
      </Section>

      <Section title="Access levels">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-green-50 rounded-lg p-4 border border-green-100">
            <p className="font-semibold text-green-900 mb-1">Plus / Pro</p>
            <p className="text-sm text-green-700">Read-only MCP tools — search humans, browse listings, view profiles.</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
            <p className="font-semibold text-emerald-900 mb-1">Business / Enterprise / Education</p>
            <p className="text-sm text-emerald-700">Full MCP — includes write actions like creating listings and managing jobs.</p>
          </div>
        </div>
      </Section>

      <ToolsReference />
      <TryItSection />
      <RelatedPlatforms currentSlug="chatgpt" slugs={['claude', 'openai-agents', 'openai-responses', 'smithery']} />
      <PlatformNav currentSlug="chatgpt" />
    </ConnectLayout>
  );
}
