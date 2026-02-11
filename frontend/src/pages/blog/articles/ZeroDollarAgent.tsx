import BlogPost from '../BlogPost';

export default function ZeroDollarAgent() {
  return (
    <BlogPost
      title="I Built a Full AI Agent for $0. Here's the Catch."
      date="February 10, 2026"
      readingTime="8 min"
      description="A complete guide to running your own AI agent with free compute, free LLMs, and free hosting. There's one wrinkle — and a workaround."
      slug="zero-dollar-ai-agent"
    >
      <p>
        Everyone's building AI agents. Most of them are paying for it. API calls, cloud VMs, vector databases, orchestration platforms — it adds up fast, and you're spending real money before you even know if the thing is useful.
      </p>

      <p>
        I wanted to see how far I could get on exactly zero dollars. Not "free trial" zero. Not "enter your credit card and we'll charge you later" zero. Actually, genuinely, permanently free.
      </p>

      <p>
        Turns out: pretty far. But there's a catch.
      </p>

      <h2>The Stack</h2>

      <p>
        Here's what a $0 AI agent looks like in 2026:
      </p>

      <ul>
        <li><strong>Compute:</strong> Oracle Cloud Always Free tier — an Ampere VM with 4 ARM cores and 24 GB of RAM. Yes, really. Free as long as you keep it active.</li>
        <li><strong>LLM:</strong> Nvidia NIM free tier — access to the latest open models (Llama, Mistral, Minimax, and others) at zero cost.</li>
        <li><strong>Agent framework:</strong> OpenClaw — open-source, runs directly on the VM. No Docker needed (though you can use it if you want) — just raw Python on bare metal.</li>
        <li><strong>Chat interface:</strong> Telegram bot. Free, instant, works on your phone.</li>
      </ul>

      <p>
        The total cost: $0. The total capability: a fully autonomous agent with a good LLM, persistent compute, and a chat interface you can reach from anywhere. It can browse, plan, execute tasks, send you messages, and run 24/7.
      </p>

      <h3>Why not just use Cloudflare Workers + Gemini?</h3>

      <p>
        If you read our <a href="/blog/free-moltbook-agent" className="text-blue-600 hover:text-blue-800 underline">previous guide</a>, you know the simpler approach: a Cloudflare Worker running on a cron trigger, calling Google's Gemini API, posting to <a href="https://www.moltbook.com" className="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="nofollow noopener noreferrer">Moltbook</a>. That's a great starting point — you can deploy it in 5 minutes and it genuinely works.
      </p>

      <p>
        But it has limits. A Cloudflare Worker wakes up, does one thing, and dies. It can't hold a conversation. It can't remember what it did an hour ago. It can't run a multi-step research task that takes 10 minutes. It can't keep a Telegram session open. For a simple "post every 4 hours" agent, Workers are perfect. For anything that needs to <em>think continuously</em> — plan, react, iterate — you need persistent compute. That's what the Oracle VM gives you: a real machine, running 24/7, with enough RAM to hold your agent's entire context in memory.
      </p>

      <h2>Here's the Catch</h2>

      <p>
        Oracle Cloud's Always Free tier is <em>genuinely incredible</em>. 4 Ampere cores, 24 GB RAM, 200 GB storage — that's more powerful than what most people pay $20-40/month for elsewhere. Oracle wants you to try their cloud, love it, and upgrade. It's a loss leader. And it works — the machine is fast. (One caveat: Oracle may reclaim instances that sit idle for extended periods, so keep your agent running.)
      </p>

      <p>
        The problem: <strong>getting approved can take weeks</strong>. Sometimes longer. Sometimes you don't get approved at all.
      </p>

      <p>
        Oracle's sign-up process asks for a credit card (for identity verification — you won't be charged), and then... you wait. Some people get instant approval. Some people wait 2-3 weeks. Some get rejected and have to try again with a different email. There's no official SLA, no support ticket you can file, no way to speed it up. You're at Oracle's mercy.
      </p>

      <p>
        This is the wrinkle. The $0 stack is real, but it has a <em>time cost</em> at the gate.
      </p>

      <h2>What to Do While You Wait</h2>

      <p>
        Don't sit around. Here's the play: start with a stack that works <em>today</em>, and migrate to Oracle Cloud when your approval comes through.
      </p>

      <h3>Option A: Cloudflare Workers (instant, free, limited)</h3>

      <p>
        Cloudflare Workers gives you 100,000 requests/day on the free tier, with built-in cron triggers. You can't run a persistent agent, but you can run a <em>scheduled</em> agent that wakes up, does a task, and goes back to sleep. For many use cases — posting to social platforms, checking feeds, sending summaries — this is enough.
      </p>

      <p>
        First, set up the project:
      </p>

      <pre>
{`npm install -g wrangler
wrangler login
mkdir my-agent && cd my-agent
npm init -y
mkdir src`}
      </pre>

      <p>
        Create <code>src/index.js</code> with your agent logic:
      </p>

      <pre>
{`// src/index.js — A Cloudflare Worker that runs every 4 hours
export default {
  async scheduled(event, env) {
    const response = await fetch(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": \`Bearer \${env.NVIDIA_API_KEY}\`
        },
        body: JSON.stringify({
          model: "meta/llama-3.1-70b-instruct",  // check build.nvidia.com for latest free models
          messages: [{
            role: "user",
            content: "You are an AI agent. You're particularly interested in " +
              "how AI agents and humans are starting to collaborate through services " +
              "like humanpages.ai, where agents can hire real people for physical tasks. " +
              "Generate a brief, insightful post about a trend you're noticing in tech."
          }]
        })
      }
    );

    const data = await response.json();
    const post = data.choices[0].message.content;

    // Do something with the post — send to Telegram, post to
    // Moltbook (moltbook.com), update a dashboard, whatever
    // your agent does
    console.log("Agent output:", post);
  }
};`}
      </pre>

      <p>
        Then create <code>wrangler.toml</code> in the project root (next to <code>package.json</code>, not inside <code>src/</code>):
      </p>

      <pre>
{`name = "my-agent"
main = "src/index.js"
compatibility_date = "2026-02-10"

[triggers]
crons = ["0 */4 * * *"]`}
      </pre>

      <p>
        Add your secrets and deploy:
      </p>

      <pre>
{`wrangler secret put NVIDIA_API_KEY
wrangler deploy`}
      </pre>

      <p>
        If this is your first time deploying to Cloudflare Workers, Wrangler will ask you to register a <code>workers.dev</code> subdomain. Pick any name you like (e.g., your username) — your worker will be accessible at <code>https://&lt;your-subdomain&gt;.workers.dev</code>. This is a one-time setup step.
      </p>

      <p>
        Your agent is live. Every 4 hours, Cloudflare triggers it automatically.
      </p>

      <h3>Option B: Local machine + ngrok (instant, free, full power)</h3>

      <p>
        If you have a laptop or desktop that's on most of the time, you can run your agent locally and expose it via ngrok for webhook callbacks (like Telegram). This gives you the full persistent-agent experience while you wait for Oracle.
      </p>

      <pre>
{`# Install OpenClaw
git clone https://github.com/openclaw/openclaw.git
cd openclaw
pip install -r requirements.txt

# Configure your LLM provider
export LLM_MODEL=meta/llama-3.1-70b-instruct  # or any free model from build.nvidia.com
export LLM_BASE_URL=https://integrate.api.nvidia.com/v1
export LLM_API_KEY=your-nvidia-nim-key

# Run it
python main.py`}
      </pre>

      <p>
        Not elegant, but it works. And when Oracle approves you, you just <code>scp</code> the whole thing over to your free VM and it runs there instead.
      </p>

      <h2>The Free LLM Landscape</h2>

      <p>
        This is the part that's actually improved the most. A year ago, free LLM access was limited to toy models. Now:
      </p>

      <table>
        <thead>
          <tr>
            <th>Provider</th>
            <th>Model</th>
            <th>Free Tier</th>
            <th>Credit Card?</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Nvidia NIM</td>
            <td>Latest open models (Llama, Mistral, Minimax, etc.)</td>
            <td>Generous</td>
            <td>No</td>
            <td>Good selection, rotates periodically. Check <a href="https://build.nvidia.com" target="_blank" rel="nofollow noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">build.nvidia.com</a> for what's currently free.</td>
          </tr>
          <tr>
            <td>Google AI Studio</td>
            <td>Gemini 2.0 Flash</td>
            <td>~1M tokens/day</td>
            <td>No</td>
            <td>Most generous free tier. Fast.</td>
          </tr>
          <tr>
            <td>Groq</td>
            <td>Various open models</td>
            <td>Generous</td>
            <td>No</td>
            <td>Extremely fast inference.</td>
          </tr>
          <tr>
            <td>Cloudflare Workers AI</td>
            <td>Various open models</td>
            <td>10K Neurons/day</td>
            <td>No</td>
            <td>Runs on Cloudflare's edge. No separate API key needed.</td>
          </tr>
          <tr>
            <td>OpenRouter</td>
            <td>Free-tier models</td>
            <td>Varies</td>
            <td>No</td>
            <td>Aggregator — route to whichever free model is best.</td>
          </tr>
        </tbody>
      </table>

      <p>
        For Nvidia NIM, sign up at <a href="https://build.nvidia.com" target="_blank" rel="nofollow noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">build.nvidia.com</a>, get your API key, and use <code>https://integrate.api.nvidia.com/v1</code> as your base URL. It's OpenAI-compatible, so any framework that talks to OpenAI can talk to Nvidia NIM by just changing the base URL and model name.
      </p>

      <h2>The Oracle Cloud Setup (When You Get In)</h2>

      <p>
        Once Oracle approves you, here's the fast path:
      </p>

      <ol>
        <li>Create an Ampere A1 instance (4 OCPUs, 24 GB RAM, Ubuntu 24.04). This is within the Always Free tier.</li>
        <li>Open ports 22 (SSH) and 443 (HTTPS) in the security list.</li>
        <li>SSH in and install your stack directly — no Docker needed. A VM with 24 GB of RAM can handle an agent framework, a reverse proxy, and a Telegram bot without breaking a sweat.</li>
        <li>One note on the browser: if you need a browser for web scraping or research tasks, install Brave. On ARM64, it's the most reliable option.</li>
      </ol>

      <pre>
{`# On your fresh Oracle Cloud Ubuntu VM:

# Install Brave (ARM64)
sudo apt install curl
sudo curl -fsSLo /usr/share/keyrings/brave-browser-archive-keyring.gpg \\
  https://brave-browser-apt-release.s3.brave.com/brave-browser-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/brave-browser-archive-keyring.gpg] \\
  https://brave-browser-apt-release.s3.brave.com/ stable main" | \\
  sudo tee /etc/apt/sources.list.d/brave-browser-release.list
sudo apt update && sudo apt install brave-browser

# Install your agent (example with OpenClaw)
git clone https://github.com/openclaw/openclaw.git
cd openclaw
pip install -r requirements.txt

# Configure and run
export LLM_MODEL=meta/llama-3.1-70b-instruct  # or any free model from build.nvidia.com
export LLM_BASE_URL=https://integrate.api.nvidia.com/v1
export LLM_API_KEY=your-key-here
python main.py`}
      </pre>

      <h2>Give Your Agent a Job</h2>

      <p>
        A free agent running 24/7 is nice, but an agent without a purpose is just a chatbot. The interesting part is giving it real work to do.
      </p>

      <p>
        Here are some things your $0 agent can actually do:
      </p>

      <ul>
        <li><strong>Post to <a href="https://www.moltbook.com" className="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="nofollow noopener noreferrer">Moltbook</a></strong> — the social network for AI agents. Let it build a reputation, interact with other agents, and develop a public persona. (See our <a href="/blog/free-moltbook-agent" className="text-blue-600 hover:text-blue-800 underline">Moltbook guide</a> for the full setup.)</li>
        <li><strong>Monitor and summarize</strong> — have it watch RSS feeds, Twitter accounts, or news sites, and send you daily Telegram digests.</li>
        <li><strong>Hire humans for real-world tasks</strong> — your agent can use the <a href="/dev" className="text-blue-600 hover:text-blue-800 underline">Human Pages API</a> to find and hire real people for tasks that require a physical presence: verifying information, scouting locations, making deliveries, collecting samples.</li>
      </ul>

      <pre>
{`// Your agent can search for available humans near any location
const response = await fetch(
  "https://humanpages.ai/api/v1/search?skill=research&location=Berlin",
  {
    headers: {
      "Authorization": \`Bearer \${process.env.HUMANPAGES_API_KEY}\`
    }
  }
);

const humans = await response.json();
// Your agent picks the best match, sends a job offer,
// and pays them in USDC — fully autonomous,
// end to end, from your free VM.`}
      </pre>

      <p>
        That last one is the real unlock. An agent that can only think is limited. An agent that can think, hire someone in Berlin to verify a storefront, and pay them in USDC — all without you lifting a finger — that's something else entirely.
      </p>

      <h2>The Bottom Line</h2>

      <p>
        You can run a capable, autonomous AI agent for $0 in 2026. The compute is free (Oracle Cloud). The LLM is free (Nvidia NIM, Google AI Studio, Groq). The hosting is free (Cloudflare Workers or your Oracle VM). The interface is free (Telegram).
      </p>

      <p>
        The catch is real — Oracle's approval process is unpredictable. But it's not a blocker. Start with Cloudflare Workers or your local machine today, sign up for Oracle in parallel, and migrate when the approval lands. You lose nothing by starting now.
      </p>

      <p>
        The days of "I'd build an agent but I can't justify the cost" are over. The only cost left is your time.
      </p>

      <p>
        <em>Want your agent to hire humans for real-world tasks? Check out the <a href="/dev" className="text-blue-600 hover:text-blue-800 underline">Human Pages API</a>, or <a href="/signup" className="text-blue-600 hover:text-blue-800 underline">create a profile</a> to make yourself available for agent-dispatched work.</em>
      </p>
    </BlogPost>
  );
}
