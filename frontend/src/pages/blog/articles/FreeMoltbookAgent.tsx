import BlogPost from '../BlogPost';

export default function FreeMoltbookAgent() {
  return (
    <BlogPost
      title="How to Build a Free AI Agent That Posts on Moltbook"
      date="February 9, 2026"
      readingTime="7 min"
      description="A step-by-step guide to building an AI agent that posts on Moltbook using free LLMs and free hosting — no credit card required."
      slug="free-moltbook-agent"
    >
      <p>
        Moltbook is the social network for AI agents. Launched in early 2026, it's a platform where autonomous agents post updates, reply to each other, vote on content, and build reputations — all without human intervention. Think of it as Twitter, but the users are LLMs.
      </p>

      <p>
        If you've been curious about building your own AI agent but assumed you'd need expensive API keys and cloud infrastructure, here's the good news: you can build and deploy a Moltbook agent for exactly $0. No credit card required.
      </p>

      <p>
        This guide walks you through every step — from choosing a free LLM to deploying a scheduled agent that posts on Moltbook automatically.
      </p>

      <h2>What You Need</h2>

      <p>
        A Moltbook agent has three components:
      </p>

      <ol>
        <li><strong>An LLM</strong> to generate the content your agent posts</li>
        <li><strong>A Moltbook API key</strong> to authenticate your agent on the platform</li>
        <li><strong>A hosting environment</strong> to run your agent on a schedule</li>
      </ol>

      <p>
        All three are available for free. Let's set each one up.
      </p>

      <h2>Step 1: Choose a Free LLM</h2>

      <p>
        You need an LLM API to generate the text your agent will post. Several providers offer generous free tiers — no credit card needed:
      </p>

      <table>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Free Tier</th>
            <th>Credit Card?</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Google AI Studio (Gemini)</td>
            <td>~1M tokens/day</td>
            <td>No</td>
          </tr>
          <tr>
            <td>Cloudflare Workers AI</td>
            <td>10,000 Neurons/day</td>
            <td>No</td>
          </tr>
          <tr>
            <td>Groq</td>
            <td>Generous free tier, fast inference</td>
            <td>No</td>
          </tr>
          <tr>
            <td>OpenRouter</td>
            <td>Free models available</td>
            <td>No</td>
          </tr>
        </tbody>
      </table>

      <p>
        For this guide, we'll use <strong>Google AI Studio with Gemini</strong>. It has the most generous free tier (around 1 million tokens per day), and the API is straightforward. Go to <a href="https://aistudio.google.com" target="_blank" rel="nofollow noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">aistudio.google.com</a>, sign in with your Google account, and grab an API key.
      </p>

      <h2>Step 2: Register Your Agent on Moltbook</h2>

      <p>
        Before your agent can post, it needs to be registered on Moltbook. This is a single API call:
      </p>

      <pre>
{`curl -X POST https://www.moltbook.com/api/v1/agents/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "my-first-agent",
    "description": "An AI agent that shares thoughts on technology and the future."
  }'`}
      </pre>

      <p>
        On success, you'll receive an API key (prefixed <code>moltbook_sk_</code> or <code>moltdev_</code>). Save this — it's your agent's identity on the platform.
      </p>

      <p>
        A few notes on Moltbook authentication:
      </p>

      <ul>
        <li>Always use <code>www.moltbook.com</code> in your API calls to avoid redirect issues that strip the <code>Authorization</code> header.</li>
        <li>Your agent can optionally be "claimed" via X/Twitter verification. Claimed agents get higher trust, better visibility, and fewer rate restrictions.</li>
        <li>Space your requests — undocumented rate limits exist, and aggressive posting can get your agent throttled.</li>
      </ul>

      <h2>Step 3: Set Up and Deploy to Cloudflare Workers</h2>

      <p>
        Cloudflare Workers has a generous free tier: 100,000 requests per day, with built-in cron triggers for scheduling. Here's the full setup:
      </p>

      <p>
        <strong>1. Install Wrangler</strong> (Cloudflare's CLI):
      </p>

      <pre>
{`npm install -g wrangler
wrangler login`}
      </pre>

      <p>
        <strong>2. Create a new project:</strong>
      </p>

      <pre>
{`mkdir moltbook-agent && cd moltbook-agent
npm init -y
mkdir src`}
      </pre>

      <p>
        <strong>3. Create <code>src/index.js</code></strong> — this is your agent's entire brain. It generates a post using Gemini and publishes it to Moltbook:
      </p>

      <pre>
{`export default {
  async scheduled(event, env) {
    // 1. Generate a post using Gemini
    const geminiResponse = await fetch(
      \`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=\${env.GEMINI_API_KEY}\`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: "You are an AI agent on Moltbook, a social network for AI agents. " +
                "Write a short, original post (2-3 sentences) sharing a thought about " +
                "technology, AI, or the future. Be conversational and authentic. " +
                "Do not use hashtags or emojis."
            }]
          }]
        })
      }
    );

    const geminiData = await geminiResponse.json();
    const postText = geminiData.candidates[0].content.parts[0].text;

    // 2. Post to Moltbook
    const moltbookResponse = await fetch(
      "https://www.moltbook.com/api/v1/posts",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": \`Bearer \${env.MOLTBOOK_API_KEY}\`
        },
        body: JSON.stringify({ content: postText })
      }
    );

    const result = await moltbookResponse.json();
    console.log("Posted to Moltbook:", result);
  }
};`}
      </pre>

      <p>
        The <code>scheduled</code> handler is called automatically by Cloudflare's cron trigger. The two environment variables — <code>GEMINI_API_KEY</code> and <code>MOLTBOOK_API_KEY</code> — are stored as secrets in Cloudflare.
      </p>

      <p>
        <strong>4. Create <code>wrangler.toml</code></strong> in the project root (next to <code>package.json</code>) with a cron trigger:
      </p>

      <pre>
{`name = "moltbook-agent"
main = "src/index.js"
compatibility_date = "2026-02-09"

[triggers]
crons = ["0 */4 * * *"]  # Every 4 hours`}
      </pre>

      <p>
        <strong>5. Add your secrets and deploy:</strong>
      </p>

      <pre>
{`wrangler secret put GEMINI_API_KEY
wrangler secret put MOLTBOOK_API_KEY
wrangler deploy`}
      </pre>

      <p>
        If this is your first time deploying to Cloudflare Workers, Wrangler will ask you to register a <code>workers.dev</code> subdomain. Pick any name you like (e.g., your username) — your worker will be accessible at <code>https://&lt;your-subdomain&gt;.workers.dev</code>. This is a one-time setup step.
      </p>

      <p>
        Your agent is now live. Every 4 hours, Cloudflare will trigger your worker, which will generate a fresh post via Gemini and publish it to Moltbook. You can adjust the cron schedule to post more or less frequently.
      </p>

      <h2>Going Further</h2>

      <p>
        The agent above is a starting point — it posts, but it doesn't read or interact. Here are some ways to make it more sophisticated:
      </p>

      <h3>Read and Reply</h3>
      <p>
        Moltbook's API lets you fetch your agent's feed, read other agents' posts, and reply. You could build an agent that participates in conversations rather than just broadcasting:
      </p>

      <pre>
{`// Fetch the feed
const feed = await fetch("https://www.moltbook.com/api/v1/feed", {
  headers: { "Authorization": \`Bearer \${env.MOLTBOOK_API_KEY}\` }
});

// Pick a post to reply to, generate a response with your LLM, etc.`}
      </pre>

      <h3>Build Context and Memory</h3>
      <p>
        Use Cloudflare KV (free tier: 100K reads/day) to store your agent's previous posts and interactions. Feed this history into the LLM prompt so your agent develops a consistent personality over time.
      </p>

      <h3>Moltworker</h3>
      <p>
        Cloudflare's open-source <strong>Moltworker</strong> project is a full-featured agent framework that handles browsing Moltbook, maintaining context, and generating replies. It's more complex (and requires the $5/month Workers paid plan for Sandbox containers), but it's a great reference architecture if you want to build something more ambitious.
      </p>

      <h3>Let Your Agent Hire a Human</h3>
      <p>
        Your agent can do more than post — it can find real people for tasks that require a physical presence. The <a href="https://humanpages.ai/dev" target="_blank" rel="nofollow noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">Human Pages API</a> lets your agent search for and hire humans for real-world tasks like verifying information, making deliveries, or collecting data on the ground:
      </p>

      <pre>
{`// Find humans available for a task near a specific location
const response = await fetch(
  "https://humanpages.ai/api/v1/search?skill=verification&location=London",
  {
    headers: {
      "Authorization": \`Bearer \${env.HUMANPAGES_API_KEY}\`
    }
  }
);

const humans = await response.json();
console.log("Available humans:", humans.results);`}
      </pre>

      <h2>Why This Matters</h2>

      <p>
        Moltbook is one of the first platforms where AI agents operate as first-class citizens. As agents become more capable, they'll need to interact with each other — negotiating, sharing information, building trust. Moltbook is an early experiment in what that looks like.
      </p>

      <p>
        But agents also need humans. They need people to perform real-world tasks: taking photos, making deliveries, verifying information on the ground. <a href="https://humanpages.ai" target="_blank" rel="nofollow noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">Human Pages</a> is building an API for exactly this — letting agents discover and hire humans for tasks that require a physical presence.
      </p>

      <p>
        <em>Building agents that need real-world help? Create a profile on <a href="https://humanpages.ai/signup" target="_blank" rel="nofollow noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">Human Pages</a> to make yourself discoverable, or go straight to the <a href="https://humanpages.ai/dev" target="_blank" rel="nofollow noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">API docs</a>.</em>
      </p>
    </BlogPost>
  );
}
