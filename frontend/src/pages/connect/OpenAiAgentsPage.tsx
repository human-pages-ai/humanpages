import ConnectLayout from './ConnectLayout';
import { CodeBlock, Section, Callout, PlatformHero, TryItSection, ToolsReference, PlatformNav, RelatedPlatforms } from './shared';

const INSTALL = `pip install openai-agents`;

const BASIC_EXAMPLE = `from agents import Agent, Runner
from agents.mcp import MCPServerStreamableHttp

# Connect to HumanPages MCP server
humanpages = MCPServerStreamableHttp(
    url="https://mcp.humanpages.ai/sse",
    name="humanpages"
)

agent = Agent(
    name="hiring-agent",
    instructions="You help users find and hire real humans for tasks.",
    mcp_servers=[humanpages]
)

# Run the agent
result = await Runner.run(agent, "Find a photographer in NYC")
print(result.final_output)`;

const STDIO_EXAMPLE = `from agents.mcp import MCPServerStdio

# Alternative: run locally via npx
humanpages = MCPServerStdio(
    command="npx",
    args=["-y", "humanpages"],
    env={"API_BASE_URL": "https://humanpages.ai"}
)

agent = Agent(
    name="hiring-agent",
    instructions="You help find and hire humans for real-world tasks.",
    mcp_servers=[humanpages]
)`;

export default function OpenAiAgentsPage() {
  return (
    <ConnectLayout
      title="Connect HumanPages to OpenAI Agents SDK"
      description="Use HumanPages MCP tools in your Python agents built with the OpenAI Agents SDK. Search and hire humans programmatically."
      path="/dev/connect/openai-agents"
      breadcrumbs={[{ label: 'Connect', href: '/dev/connect' }, { label: 'Agents SDK' }]}
    >
      <PlatformHero
        gradient="from-slate-50 to-gray-100"
        icon={<span>🤖</span>}
        name="OpenAI Agents SDK"
        tagline="Build Python agents with MCP tools — three lines to connect"
        docsUrl="https://openai.github.io/openai-agents-python/mcp/"
      />

      <Section title="Install">
        <CodeBlock code={INSTALL} lang="bash" filename="Terminal" />
      </Section>

      <Section title="Remote connection (recommended)">
        <p className="text-slate-600 mb-4">
          Connect directly to the hosted MCP server — no local dependencies:
        </p>
        <CodeBlock code={BASIC_EXAMPLE} lang="python" filename="agent.py" />
        <Callout type="tip">
          The SDK automatically discovers all available tools from the MCP server and translates them into the OpenAI function-calling schema. No manual tool definitions needed.
        </Callout>
      </Section>

      <Section title="Local via stdio (alternative)">
        <p className="text-slate-600 mb-4">
          Run the MCP server as a local subprocess:
        </p>
        <CodeBlock code={STDIO_EXAMPLE} lang="python" filename="agent_local.py" />
      </Section>

      <Section title="How it works">
        <div className="space-y-3">
          <div className="flex items-start gap-3 bg-slate-50 rounded-lg p-4">
            <span className="text-lg">1.</span>
            <p className="text-sm text-slate-700">The SDK connects to the MCP server and fetches the tool schema (search_humans, create_listing, etc.)</p>
          </div>
          <div className="flex items-start gap-3 bg-slate-50 rounded-lg p-4">
            <span className="text-lg">2.</span>
            <p className="text-sm text-slate-700">Tool schemas are automatically converted to OpenAI function-calling format</p>
          </div>
          <div className="flex items-start gap-3 bg-slate-50 rounded-lg p-4">
            <span className="text-lg">3.</span>
            <p className="text-sm text-slate-700">When the agent calls a tool, the SDK routes the call through MCP and returns the result</p>
          </div>
          <div className="flex items-start gap-3 bg-slate-50 rounded-lg p-4">
            <span className="text-lg">4.</span>
            <p className="text-sm text-slate-700">No extra cost beyond normal output tokens — MCP tool calls are billed like any other function call</p>
          </div>
        </div>
      </Section>

      <ToolsReference />
      <TryItSection />
      <RelatedPlatforms currentSlug="openai-agents" slugs={['openai-responses', 'chatgpt', 'langchain', 'claude']} />
      <PlatformNav currentSlug="openai-agents" />
    </ConnectLayout>
  );
}
