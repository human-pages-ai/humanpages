import ConnectLayout from './ConnectLayout';
import { CodeBlock, Section, Callout, PlatformHero, TryItSection, ToolsReference, PlatformNav, RelatedPlatforms } from './shared';

const LANGCHAIN_EXAMPLE = `from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI

model = ChatOpenAI(model="gpt-4o")

async with MultiServerMCPClient(
    {
        "humanpages": {
            "url": "https://mcp.humanpages.ai/mcp",
            "transport": "sse",
        }
    }
) as client:
    tools = client.get_tools()
    agent = create_react_agent(model, tools)

    result = await agent.ainvoke(
        {"messages": [{"role": "user", "content": "Find QA testers in Berlin"}]}
    )
    print(result["messages"][-1].content)`;

const LLAMAINDEX_EXAMPLE = `from llama_index.tools.mcp import BasicMCPClient, McpToolSpec

mcp_client = BasicMCPClient("https://mcp.humanpages.ai/mcp")
mcp_tool_spec = McpToolSpec(client=mcp_client)

# Get tools as LlamaIndex tools
tools = await mcp_tool_spec.to_tool_list_async()

# Use with any LlamaIndex agent
from llama_index.agent.openai import OpenAIAgent

agent = OpenAIAgent.from_tools(tools)
response = await agent.achat("Find a photographer in NYC")`;

const INSTALL_LANGCHAIN = `pip install langchain-mcp-adapters langgraph langchain-openai`;
const INSTALL_LLAMAINDEX = `pip install llama-index-tools-mcp`;

export default function LangChainPage() {
  return (
    <ConnectLayout
      title="Connect HumanPages to LangChain & LlamaIndex"
      description="Use HumanPages MCP tools in LangChain agents and LlamaIndex pipelines. Framework-level integration with automatic tool schema translation."
      path="/dev/connect/langchain"
      breadcrumbs={[{ label: 'Connect', href: '/dev/connect' }, { label: 'LangChain' }]}
      ogPlatform="langchain"
    >
      <PlatformHero
        gradient="from-purple-50 to-violet-50"
        icon={<span>🔗</span>}
        name="LangChain & LlamaIndex"
        tagline="Framework-level MCP integration — works with any LLM backend"
        docsUrl="https://python.langchain.com/docs/integrations/tools/mcp/"
      />

      {/* ── LangChain ──────────────────────────────────────── */}
      <Section title="LangChain + LangGraph">
        <CodeBlock code={INSTALL_LANGCHAIN} lang="bash" filename="Terminal" />
        <div className="mt-4">
          <CodeBlock code={LANGCHAIN_EXAMPLE} lang="python" filename="langchain_agent.py" />
        </div>
        <Callout type="tip">
          <code>MultiServerMCPClient</code> supports connecting to multiple MCP servers simultaneously. You can combine HumanPages with other MCP tools in a single agent.
        </Callout>
      </Section>

      {/* ── LlamaIndex ─────────────────────────────────────── */}
      <Section title="LlamaIndex">
        <CodeBlock code={INSTALL_LLAMAINDEX} lang="bash" filename="Terminal" />
        <div className="mt-4">
          <CodeBlock code={LLAMAINDEX_EXAMPLE} lang="python" filename="llamaindex_agent.py" />
        </div>
      </Section>

      <Section title="Why use a framework?">
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
            <p className="font-semibold text-purple-900 mb-1">Any LLM</p>
            <p className="text-sm text-purple-700">Not locked to OpenAI — use Claude, Gemini, Llama, Mistral, or any model your framework supports.</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
            <p className="font-semibold text-purple-900 mb-1">Multi-server</p>
            <p className="text-sm text-purple-700">Combine HumanPages with file system, database, and other MCP tools in one agent.</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
            <p className="font-semibold text-purple-900 mb-1">Auto-translation</p>
            <p className="text-sm text-purple-700">MCP tool schemas are automatically translated to the framework's native tool format.</p>
          </div>
        </div>
      </Section>

      <ToolsReference />
      <TryItSection />
      <RelatedPlatforms currentSlug="langchain" slugs={['openai-agents', 'openai-responses', 'claude', 'nanobot']} />
      <PlatformNav currentSlug="langchain" />
    </ConnectLayout>
  );
}
