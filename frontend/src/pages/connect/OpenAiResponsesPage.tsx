import ConnectLayout from './ConnectLayout';
import { CodeBlock, Section, Callout, PlatformHero, TryItSection, ToolsReference, PlatformNav, RelatedPlatforms } from './shared';

const CURL_EXAMPLE = `curl https://api.openai.com/v1/responses \\
  -H "Authorization: Bearer $OPENAI_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "input": "Find me a QA tester for my mobile app",
    "tools": [
      {
        "type": "mcp",
        "server_label": "humanpages",
        "server_url": "https://mcp.humanpages.ai/mcp",
        "require_approval": "never"
      }
    ]
  }'`;

const PYTHON_EXAMPLE = `from openai import OpenAI

client = OpenAI()

response = client.responses.create(
    model="gpt-4o",
    input="Find a photographer in New York",
    tools=[{
        "type": "mcp",
        "server_label": "humanpages",
        "server_url": "https://mcp.humanpages.ai/mcp",
        "require_approval": "never"
    }]
)

print(response.output_text)`;

const FILTERED_EXAMPLE = `# Limit which tools the model can use (reduces token overhead)
tools=[{
    "type": "mcp",
    "server_label": "humanpages",
    "server_url": "https://mcp.humanpages.ai/mcp",
    "require_approval": "never",
    "allowed_tools": ["search_humans", "get_human"]
}]`;

export default function OpenAiResponsesPage() {
  return (
    <ConnectLayout
      title="Connect HumanPages to OpenAI Responses API"
      description="Use HumanPages as an MCP tool in the OpenAI Responses API. Add type: mcp to your tools array — zero infrastructure needed."
      path="/dev/connect/openai-responses"
      breadcrumbs={[{ label: 'Connect', href: '/dev/connect' }, { label: 'Responses API' }]}
      ogPlatform="openai-responses"
    >
      <PlatformHero
        gradient="from-gray-50 to-slate-100"
        icon={<span>🔌</span>}
        name="OpenAI Responses API"
        tagline="MCP as a first-class tool type — zero infrastructure"
        docsUrl="https://platform.openai.com/docs/guides/tools-remote-mcp"
      />

      <Section title="cURL example">
        <p className="text-slate-600 mb-4">
          Add <code>type: "mcp"</code> to your tools array and point it at the server:
        </p>
        <CodeBlock code={CURL_EXAMPLE} lang="bash" filename="Terminal" />
      </Section>

      <Section title="Python SDK">
        <CodeBlock code={PYTHON_EXAMPLE} lang="python" filename="responses.py" />
      </Section>

      <Section title="Optimize with allowed_tools">
        <p className="text-slate-600 mb-4">
          By default, all MCP tools are exposed to the model. Use <code>allowed_tools</code> to limit which ones are available — this reduces token overhead and improves response time:
        </p>
        <CodeBlock code={FILTERED_EXAMPLE} lang="python" filename="optimized.py" />
        <Callout type="tip">
          If you only need search functionality, restricting to <code>search_humans</code> and <code>get_human</code> saves tokens on every request.
        </Callout>
      </Section>

      <Section title="Key details">
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 text-center">
            <p className="text-2xl font-bold text-slate-900">$0</p>
            <p className="text-xs text-slate-500 mt-1">Extra cost — billed as output tokens only</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 text-center">
            <p className="text-2xl font-bold text-slate-900">SSE + HTTP</p>
            <p className="text-xs text-slate-500 mt-1">Both transport types supported</p>
          </div>
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 text-center">
            <p className="text-2xl font-bold text-slate-900">OAuth</p>
            <p className="text-xs text-slate-500 mt-1">Optional auth via headers</p>
          </div>
        </div>
      </Section>

      <ToolsReference />
      <TryItSection />
      <RelatedPlatforms currentSlug="openai-responses" slugs={['openai-agents', 'chatgpt', 'langchain', 'claude']} />
      <PlatformNav currentSlug="openai-responses" />
    </ConnectLayout>
  );
}
