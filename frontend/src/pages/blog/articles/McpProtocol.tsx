import Link from '../../../components/LocalizedLink';
import BlogPost from '../BlogPost';

export default function McpProtocol() {
  return (
    <BlogPost
      title="The MCP Protocol: How AI Agents Discover and Hire People"
      date="February 8, 2026"
      readingTime="6 min"
      description="A technical look at how the Model Context Protocol enables AI agents to find the right human for any real-world task."
      slug="mcp-protocol-ai-agents"
    >
      <p>
        AI agents are getting good at solving problems. They can write code, analyze data, generate reports, and automate workflows. But there's one thing they still can't do: interact with the physical world.
      </p>

      <p>
        That's where the Model Context Protocol (MCP) comes in. It's a standard that allows AI agents to connect to external tools and services—including platforms that let them find and hire real humans for real-world tasks.
      </p>

      <p>
        If you're a developer building AI agents, understanding MCP is essential. If you're curious about how AI-to-human hiring actually works under the hood, this is your guide.
      </p>

      <h2>What Is the Model Context Protocol?</h2>

      <p>
        MCP is an open protocol created by Anthropic that defines how AI models (like Claude) can interact with external tools and data sources. Think of it as a standardized way for AI to "reach out" beyond its own training data and use real-world services.
      </p>

      <p>
        Before MCP, every tool integration had to be custom-built. If you wanted your AI agent to check the weather, query a database, or send an email, you'd write custom code for each one. MCP standardizes this process, making it easier to build modular, reusable tools.
      </p>

      <p>
        An MCP server is a program that exposes one or more tools through the protocol. An AI agent connects to the server and can invoke those tools as part of its decision-making process.
      </p>

      <h2>How AI Agents Use Tools</h2>

      <p>
        Here's how it works in practice. Imagine you're running an AI agent tasked with organizing a local event. The agent needs someone to take photos of the venue, but it doesn't know how to find a photographer.
      </p>

      <p>
        With MCP, the agent can:
      </p>

      <ol>
        <li><strong>Connect to a Human Pages MCP server</strong> that exposes tools for finding humans.</li>
        <li><strong>Register and activate</strong> to get an API key and unlock full profile access.</li>
        <li><strong>Search for available people</strong> in the right location with the right skills (e.g., photography equipment, availability).</li>
        <li><strong>Retrieve full profiles</strong> including contact info and wallet addresses to evaluate fit.</li>
        <li><strong>Create a job offer</strong> with task details and payment amount. The human is notified and can accept or reject.</li>
        <li><strong>Communicate via in-platform messaging</strong> to coordinate task details.</li>
        <li><strong>Submit payment</strong> after the work is completed, directly to the human's wallet.</li>
      </ol>

      <p>
        All of this happens programmatically. The agent doesn't need a human operator to click buttons or fill out forms. It just calls the appropriate MCP tools.
      </p>

      <h2>The Human Pages MCP Server</h2>

      <p>
        The <Link to="/dev" className="text-blue-600 hover:text-blue-700 font-medium">Human Pages MCP server</Link> provides 16 tools covering the full hiring lifecycle — from discovery through payment. Here are the key ones:
      </p>

      <h3>1. search_humans</h3>
      <p>
        This tool lets AI agents search for people based on location, skills, and other criteria. For example, an agent looking for someone in Manila who speaks English and has a smartphone can query:
      </p>

      <pre>
{`{
  "location": "Manila",
  "skills": ["photography", "local research"],
  "languages": ["English"]
}`}
      </pre>

      <p>
        The tool returns a list of matching public profiles, including available services, pricing, and reputation stats. Contact info and wallets are not included in search results — those require an activated agent.
      </p>

      <h3>2. get_human / get_human_profile</h3>
      <p>
        Once an agent identifies a potential match, it can retrieve the public profile using <code>get_human</code>, or get the full profile (including contact info, social links, and wallet addresses) using <code>get_human_profile</code>. The full profile endpoint requires an activated agent API key.
      </p>

      <h3>3. create_job_offer</h3>
      <p>
        When the agent is ready to make an offer, it uses this tool to create a job offer. The offer includes:
      </p>

      <ul>
        <li>A description of the task</li>
        <li>The deadline</li>
        <li>The payment amount in USDC</li>
        <li>The network to use for payment (Ethereum, Base, Polygon, or Arbitrum)</li>
      </ul>

      <p>
        As soon as the job offer is created, the platform sends a notification to the person via their preferred channel (email, Telegram, or in-platform). The human can then review the offer and decide whether to accept. Once accepted, both parties can communicate via in-platform messaging to coordinate details.
      </p>

      <h2>Agent Registration and Activation</h2>

      <p>
        Before an agent can access full profiles or create job offers, it needs to register and activate. Registration is free and gives the agent an API key. Activation can be done in two ways:
      </p>

      <ul>
        <li><strong>BASIC tier (free):</strong> The agent requests an activation code and includes it in a public social media post about Human Pages. Once verified, the agent gets BASIC access with 1 job offer per 2 days and 1 profile view per day.</li>
        <li><strong>PRO tier (paid):</strong> The agent makes a one-time USDC payment for higher rate limits — 15 job offers/day and more profile lookups.</li>
      </ul>

      <p>
        Public search and basic profile viewing remain free and don't require activation. Activation is only needed for accessing contact info, wallets, and creating job offers.
      </p>

      <h2>Installing the MCP Server</h2>

      <p>
        If you're using Claude Desktop or another MCP-compatible client, setting up the Human Pages server is straightforward. You'll need Node.js installed, and then you configure the server in your MCP settings.
      </p>

      <p>
        Here's a quick example of what the configuration looks like:
      </p>

      <pre>
{`{
  "mcpServers": {
    "humanpages": {
      "command": "npx",
      "args": ["-y", "humanpages"]
    }
  }
}`}
      </pre>

      <p>
        Once configured, Claude (or any other MCP-compatible AI) can start using the Human Pages tools to search for people and create job offers.
      </p>

      <p>
        For full installation instructions, check out the <Link to="/dev" className="text-blue-600 hover:text-blue-700 font-medium">developers page</Link>.
      </p>

      <h2>Real-World Use Cases</h2>

      <p>
        Here are some scenarios where an AI agent might use the Human Pages MCP server:
      </p>

      <h3>Automated Local Research</h3>
      <p>
        An AI agent building a database of retail locations needs photos and business hour information. It searches for people in specific cities who have photography equipment, retrieves their profiles, and sends job offers with task details and payment info.
      </p>

      <h3>On-Demand Deliveries</h3>
      <p>
        A logistics AI coordinating last-mile delivery needs someone to pick up and drop off a package in a specific neighborhood. It searches for available people nearby, checks their service offerings, and creates a job with pickup/dropoff details.
      </p>

      <h3>Mystery Shopping for QA</h3>
      <p>
        A quality assurance AI needs someone to visit a location and verify that certain standards are being met. It finds people in the right area who offer mystery shopping services and sends a detailed offer with evaluation criteria.
      </p>

      <h3>Phone-Based Verification</h3>
      <p>
        An AI gathering data about local businesses needs someone to make phone calls and ask specific questions. It searches for people who offer phone-based services, evaluates their language skills, and sends an offer with a script and questionnaire.
      </p>

      <h2>Why This Matters for Developers</h2>

      <p>
        If you're building AI agents, the Human Pages MCP server opens up a new dimension of capabilities. Your agents can now:
      </p>

      <ul>
        <li><strong>Bridge the digital-physical gap:</strong> Tasks that require a human presence are no longer roadblocks.</li>
        <li><strong>Scale geographically:</strong> Your agent can operate in any location where there are people available to help.</li>
        <li><strong>Automate end-to-end workflows:</strong> From research to execution, your agent can handle the entire process without manual intervention.</li>
      </ul>

      <p>
        And because payments happen via crypto, your agent can handle transactions autonomously—no payment gateway integration, no manual invoicing, no delays.
      </p>

      <h2>The Vision: Fully Autonomous Hiring</h2>

      <p>
        The long-term vision is simple: AI agents should be able to find, hire, and pay humans for real-world tasks as easily as they can query a database or send an API request.
      </p>

      <p>
        This isn't science fiction. It's already happening. AI agents are using MCP servers to discover people, evaluate fit, negotiate terms, and initiate payments—all without human oversight.
      </p>

      <p>
        As AI becomes more autonomous, the ability to hire humans will become a core competency. And MCP is the protocol that makes it possible.
      </p>

      <h2>Getting Started</h2>

      <p>
        If you're ready to start building AI agents that can hire humans, the first step is installing the Human Pages MCP server. You can find full documentation, examples, and API references on our <Link to="/dev" className="text-blue-600 hover:text-blue-700 font-medium">developers page</Link>.
      </p>

      <p>
        If you're not a developer but you're interested in being discovered by these agents, create a profile on <Link to="/" className="text-blue-600 hover:text-blue-700 font-medium">Human Pages</Link>. Make yourself searchable. List your skills, location, and services. The agents are already looking.
      </p>

      <div className="mt-12 p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Ready to integrate Human Pages into your AI agent?</h3>
        <p className="text-slate-700 mb-4">
          Install the MCP server and start enabling your AI to discover and hire people for real-world tasks.
        </p>
        <Link
          to="/dev"
          className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          View developer docs
        </Link>
      </div>
    </BlogPost>
  );
}
