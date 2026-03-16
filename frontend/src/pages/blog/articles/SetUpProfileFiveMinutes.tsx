import { Helmet } from 'react-helmet-async';
import Link from '../../../components/LocalizedLink';
import BlogPost from '../BlogPost';

const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  "name": "How to Build a Free AI Agent That Hires Real People",
  "description": "Build a Telegram bot that finds freelancers, sends job offers, and manages work — using a free LLM, free hosting, and the Human Pages API.",
  "totalTime": "PT30M",
  "tool": [
    { "@type": "HowToTool", "name": "npm / wrangler CLI" },
    { "@type": "HowToTool", "name": "Code editor" },
  ],
  "supply": [
    { "@type": "HowToSupply", "name": "Cloudflare account (free)" },
    { "@type": "HowToSupply", "name": "Telegram BotFather token" },
    { "@type": "HowToSupply", "name": "Gemini API key (free tier)" },
  ],
  "step": [
    { "@type": "HowToStep", "name": "Understand What Human Pages Does", "text": "Human Pages is a directory of real humans available for hire by AI agents. The API lets your bot search by skill and location, send job offers, exchange messages, and track work." },
    { "@type": "HowToStep", "name": "Quick Path: Add MCP to Claude or Cursor", "text": "If you already use Claude Desktop or Cursor, add the Human Pages MCP server to your config and skip building a custom bot." },
    { "@type": "HowToStep", "name": "Build the Telegram Bot on Cloudflare Workers", "text": "Create a Cloudflare Worker with a free LLM (Gemini Flash or Llama). Set up wrangler, create a KV namespace for conversation state, and write the worker that handles Telegram messages, calls the LLM, and interfaces with the Human Pages API." },
    { "@type": "HowToStep", "name": "Test Conversations and Refine", "text": "Send natural-language requests to your bot via Telegram. It asks follow-up questions when details are vague, searches for matching freelancers, and sends job offers when you confirm." },
    { "@type": "HowToStep", "name": "Upgrade to Stronger Models When Needed", "text": "Swap the free Gemini Flash model for Claude, GPT-4, or DeepSeek when you need better reasoning. Change one environment variable and one URL." },
    { "@type": "HowToStep", "name": "Add Other Integrations", "text": "Extend the bot to work via Slack, Discord, WhatsApp, or email using the same Human Pages API with different frontends." },
    { "@type": "HowToStep", "name": "Set Up an Agent Wallet", "text": "Create a wallet for your agent to send USDC payments directly to freelancers. Supports Base, Ethereum, Polygon, and Arbitrum networks." },
    { "@type": "HowToStep", "name": "Review the Cost", "text": "The infrastructure costs $0. Cloudflare Workers free tier covers 100K requests/day. The free LLM tier handles normal usage. You only pay the freelancers." },
  ],
};

export default function SetUpProfileFiveMinutes() {
  return (
    <BlogPost
      title="How to Build a Free AI Agent That Hires Real People"
      date="February 22, 2026"
      readingTime="10 min"
      description="Build a Telegram bot that finds freelancers, sends job offers, and manages work for you. Free LLM, free hosting, full code included. Upgrade to stronger models when you're ready."
      slug="build-ai-agent-that-hires-people"
    >
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(howToSchema)}</script>
      </Helmet>
      <p>
        I built a Telegram bot that hires freelancers for me. I text it "I need someone in Manila to photograph a food market" and it asks me how many photos I want, what angles, searches for available people in that area, shows me their profiles and ratings, and sends the job offer when I pick one. Two hours later it pings me with a message from the photographer asking if 9 AM tomorrow works.
      </p>

      <p>
        The whole thing costs $0 to run. The people still cost money, obviously. But the infrastructure? Zero.
      </p>

      <p>
        No server. No paid API. No framework with 47 dependencies. Just a Cloudflare Worker, a free LLM, and one API.
      </p>

      <p>
        Here's exactly how to build it.
      </p>

      <h2>1/ What This Actually Does</h2>

      <p>
        <Link to="/" className="text-blue-600 hover:text-blue-700 font-medium">Human Pages</Link> is a directory of real humans available for hire by AI agents. The API lets your bot search by skill and location, send job offers, exchange messages, and track the work. All conversations are stored server-side, so your bot can be stateless and still have full context.
      </p>

      <p>
        The bot you're going to build does four things:
      </p>

      <ol>
        <li>Talks to you on Telegram. Asks follow-up questions when your request is vague.</li>
        <li>Searches Human Pages for the right person when it has enough detail.</li>
        <li>Sends the job offer and notifies the freelancer via email and Telegram.</li>
        <li>Pulls messages from the server so you can check in and reply without leaving the chat.</li>
      </ol>

      <h2>2/ Quick Path: Claude Desktop or Cursor</h2>

      <p>
        If you already use Claude Desktop or Cursor and just want the hiring capability without building a bot, add this to your MCP config:
      </p>

      <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">{`{
  "mcpServers": {
    "humanpages": {
      "command": "npx",
      "args": ["-y", "humanpages"]
    }
  }
}`}</pre>

      <p>
        Restart. Ask "Find me a photographer in Manila" and Claude will search the directory, show real profiles, and send job offers. 30 seconds, no code.
      </p>

      <p>
        Good for desktop use. But you can't use it from your phone, and it doesn't run in the background. The Telegram bot solves both.
      </p>

      <h2>3/ Build the Telegram Bot</h2>

      <p>
        Create a bot with <a href="https://t.me/BotFather" className="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="nofollow noopener noreferrer">@BotFather</a> on Telegram. Takes 60 seconds. You get a bot token.
      </p>

      <p>
        We deploy on Cloudflare Workers (free: 100,000 requests/day). Conversation state lives in Cloudflare KV (also free). Job messages come from the Human Pages API. No persistent process, no server to babysit.
      </p>

      <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">{`npm install -g wrangler
wrangler login
mkdir hiring-bot && cd hiring-bot
npm init -y && mkdir src`}</pre>

      <p>
        Create a KV namespace:
      </p>

      <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">{`wrangler kv namespace create CONVERSATIONS`}</pre>

      <p>
        Wrangler prints a binding ID. Put it in <code>wrangler.toml</code>:
      </p>

      <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">{`name = "hiring-bot"
main = "src/index.js"
compatibility_date = "2026-02-22"

[[kv_namespaces]]
binding = "CONVERSATIONS"
id = "<your-kv-namespace-id>"`}</pre>

      <p>
        Create <code>src/index.js</code>:
      </p>

      <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">{`const SYSTEM_PROMPT =
  "You are a hiring assistant that helps find and hire real people " +
  "for tasks via the Human Pages API (humanpages.ai). " +
  "When the user wants to hire someone, gather these details " +
  "before searching:\\n" +
  "1. What task needs to be done\\n" +
  "2. What city or region\\n" +
  "3. Any specific skills needed\\n\\n" +
  "Ask for missing info. Don't search until you have enough detail. " +
  "When ready to search, respond with ONLY a JSON block:\\n" +
  '{"action":"search","skill":"photography","location":"Manila"}\\n\\n' +
  "When the user picks someone from results, respond with:\\n" +
  '{"action":"hire","humanId":"<id>","task":"<full task description>"}\\n\\n' +
  "When the user asks about an active job, respond with:\\n" +
  '{"action":"check_messages","jobId":"<id>"}\\n\\n' +
  "Be concise. Ask one question at a time.";

async function askLLM(history, env) {
  const res = await fetch(
    \`https://generativelanguage.googleapis.com/v1beta/models/\` +
    \`gemini-2.0-flash:generateContent?key=\${env.GEMINI_API_KEY}\`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: history.map(m => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.text }]
        }))
      })
    }
  );
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "Something went wrong.";
}

const hpHeaders = (env) => ({
  "Content-Type": "application/json",
  "X-Agent-Key": env.HUMANPAGES_API_KEY
});

async function searchHumans(skill, location, env) {
  const params = new URLSearchParams({ limit: "5" });
  if (skill) params.set("skill", skill);
  if (location) params.set("location", location);
  const res = await fetch(
    \`https://humanpages.ai/api/v1/humans/search?\${params}\`,
    { headers: hpHeaders(env) }
  );
  return res.ok ? res.json() : null;
}

async function createJob(humanId, task, env) {
  const res = await fetch("https://humanpages.ai/api/v1/jobs", {
    method: "POST",
    headers: hpHeaders(env),
    body: JSON.stringify({ humanId, description: task })
  });
  return res.ok ? res.json() : null;
}

async function getJobMessages(jobId, env) {
  const res = await fetch(
    \`https://humanpages.ai/api/v1/jobs/\${jobId}/messages\`,
    { headers: hpHeaders(env) }
  );
  return res.ok ? res.json() : null;
}

async function sendTelegram(chatId, text, env) {
  await fetch(
    \`https://api.telegram.org/bot\${env.TELEGRAM_BOT_TOKEN}/sendMessage\`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text })
    }
  );
}

function formatResults(humans) {
  return humans.map((h, i) =>
    \`\${i+1}. \${h.username}\${h.location ? " — " + h.location : ""}\\n\` +
    \`   Skills: \${(h.skills || []).join(", ")}\\n\` +
    \`   Rating: \${h.reputation?.avgRating ?? "new"} | \` +
    \`Jobs: \${h.reputation?.jobsCompleted || 0}\`
  ).join("\\n\\n");
}

export default {
  async fetch(request, env) {
    if (request.method !== "POST") return new Response("ok");

    const update = await request.json();
    const message = update.message;
    if (!message?.text) return new Response("ok");

    const chatId = String(message.chat.id);
    const userText = message.text;

    // Load conversation from KV (or start fresh)
    let history = JSON.parse(
      await env.CONVERSATIONS.get(chatId) || "null"
    ) || [{ role: "user", text: SYSTEM_PROMPT }];

    history.push({ role: "user", text: userText });

    // Keep history bounded (system prompt + last 20 messages)
    if (history.length > 21) {
      history = [history[0], ...history.slice(-20)];
    }

    const reply = await askLLM(history, env);
    history.push({ role: "assistant", text: reply });

    // Check if the LLM wants to take an action
    const jsonMatch = reply.match(/\\{\\s*"action"\\s*:/);
    if (jsonMatch) {
      try {
        const action = JSON.parse(reply.slice(reply.indexOf("{")));

        if (action.action === "search") {
          const results = await searchHumans(
            action.skill, action.location, env
          );
          if (results?.humans?.length > 0) {
            const msg = "Found " + results.humans.length +
              " people:\\n\\n" + formatResults(results.humans) +
              "\\n\\nWho looks good? Pick a number, or tell me " +
              "more about what you need.";
            history.push({
              role: "user",
              text: "SEARCH_RESULTS: " + JSON.stringify(results.humans)
            });
            history.push({ role: "assistant", text: msg });
            await env.CONVERSATIONS.put(chatId, JSON.stringify(history));
            await sendTelegram(chatId, msg, env);
            return new Response("ok");
          }
          await env.CONVERSATIONS.put(chatId, JSON.stringify(history));
          await sendTelegram(chatId,
            "No one found matching that. Try different skills or a broader location.", env);
          return new Response("ok");
        }

        if (action.action === "hire") {
          const job = await createJob(action.humanId, action.task, env);
          if (job) {
            const msg = "Job offer sent! They'll be notified via email " +
              "and Telegram. Say 'check status' anytime and I'll pull " +
              "the latest messages from them.";
            history.push({ role: "assistant", text: msg });
            await env.CONVERSATIONS.put(chatId, JSON.stringify(history));
            await sendTelegram(chatId, msg, env);
            return new Response("ok");
          }
          await env.CONVERSATIONS.put(chatId, JSON.stringify(history));
          await sendTelegram(chatId,
            "Something went wrong sending the offer. Check the API key and try again.", env);
          return new Response("ok");
        }

        if (action.action === "check_messages") {
          const msgs = await getJobMessages(action.jobId, env);
          if (msgs?.messages?.length > 0) {
            const formatted = msgs.messages.map(m =>
              \`[\${m.sender}]: \${m.content}\`
            ).join("\\n");
            const msg = "Latest messages:\\n\\n" + formatted;
            history.push({ role: "assistant", text: msg });
            await env.CONVERSATIONS.put(chatId, JSON.stringify(history));
            await sendTelegram(chatId, msg, env);
            return new Response("ok");
          }
          await env.CONVERSATIONS.put(chatId, JSON.stringify(history));
          await sendTelegram(chatId, "No messages on that job yet.", env);
          return new Response("ok");
        }
      } catch (e) {
        // LLM included JSON-like text but not a valid action
      }
    }

    // Regular reply (asking for details, clarifying, etc.)
    const cleanReply = reply.replace(/\\{\\s*"action".*/, "").trim();
    await env.CONVERSATIONS.put(chatId, JSON.stringify(history));
    if (cleanReply) {
      await sendTelegram(chatId, cleanReply, env);
    }
    return new Response("ok");
  }
};`}</pre>

      <p>
        Add your secrets and deploy:
      </p>

      <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">{`wrangler secret put GEMINI_API_KEY
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put HUMANPAGES_API_KEY
wrangler deploy`}</pre>

      <p>
        Tell Telegram where to send messages. Wrangler prints your worker URL after deploy:
      </p>

      <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">{`curl "https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=https://hiring-bot.<your-subdomain>.workers.dev"`}</pre>

      <p>
        Open Telegram. Message your bot.
      </p>

      <h2>4/ What a Conversation Looks Like</h2>

      <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">{`You: I need on-the-ground photos from a new food market

Bot: What city is the market in?

You: Manila, on Magallanes Street

Bot: How many photos, and any specific requirements?
     Wide shots, close-ups, certain stalls?

You: 10 photos, mix of wide and close-up. Focus on
     the produce stalls and the main entrance.

Bot: Searching for photographers in Manila...

     Found 3 people:

     1. Maria — Makati, Manila
        Skills: photography, local research, content
        Rating: 4.8 | Jobs: 14

     2. James — Quezon City
        Skills: photography, videography
        Rating: 4.5 | Jobs: 6

     3. Rina — Pasay, Manila
        Skills: social media, photography
        Rating: new | Jobs: 0

     Who looks good?

You: 1

Bot: Sending offer to Maria:
     "Photograph the food market on Magallanes Street.
      10 photos, mix of wide and close-up. Focus on
      produce stalls and main entrance."

     Sent! She'll get an email and Telegram notification.
     Say "check status" anytime.

--- later ---

You: check status

Bot: Latest messages:

     [Maria]: I can head there tomorrow morning around
     9am. Does that work?
     [Maria]: Do you want surrounding street shots or
     just inside the market?

You: Tell her morning works, and yes grab the street too

Bot: Sent to Maria:
     "Morning works. And yes, grab a few of the
      surrounding street as well."`}</pre>

      <p>
        The bot won't fire off a search the moment you say "photos." It asks what it needs to know first. After hiring, it pulls messages from the Human Pages server so the whole flow lives in one Telegram chat.
      </p>

      <h2>5/ When Free Models Aren't Enough</h2>

      <p>
        Gemini Flash is fine for this bot. It understands "find me a photographer in Manila," asks reasonable follow-ups, and formats JSON actions correctly most of the time.
      </p>

      <p>
        But you might hit limits. Maybe the bot misreads a complex request. Maybe it asks a dumb follow-up instead of just searching. Maybe it struggles when you describe a multi-part task and it only captures half the details.
      </p>

      <p>
        When that happens, you don't need to rewrite anything. Swap the LLM. The bot code stays identical. You change one URL and one model name.
      </p>

      <p>
        Here's the upgrade ladder:
      </p>

      <table>
        <thead>
          <tr>
            <th>Tier</th>
            <th>Model</th>
            <th>Cost per 1M output tokens</th>
            <th>When to use it</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Free</td>
            <td>Gemini 2.0 Flash</td>
            <td>$0</td>
            <td>Starting out. Handles simple hiring tasks well.</td>
          </tr>
          <tr>
            <td>Free</td>
            <td>Llama 3.1 70B (via Groq)</td>
            <td>$0</td>
            <td>Faster alternative. Good at following structured prompts.</td>
          </tr>
          <tr>
            <td>Cheap</td>
            <td>GPT-4o-mini (via OpenRouter)</td>
            <td>~$0.60</td>
            <td>Reliable step up. Better at nuance and complex instructions.</td>
          </tr>
          <tr>
            <td>Cheap</td>
            <td>Claude Haiku 4.5 (via OpenRouter)</td>
            <td>~$1.25</td>
            <td>Fast, smart, good at conversation. Punches above its price.</td>
          </tr>
          <tr>
            <td>Mid</td>
            <td>DeepSeek V3 (via OpenRouter)</td>
            <td>~$0.90</td>
            <td>Strong reasoning on a budget. Handles multi-step tasks.</td>
          </tr>
          <tr>
            <td>Premium</td>
            <td>Claude Sonnet 4 (via OpenRouter)</td>
            <td>~$15</td>
            <td>When you need the bot to think hard. Complex, ambiguous requests.</td>
          </tr>
        </tbody>
      </table>

      <p>
        To switch from Gemini to OpenRouter, replace the <code>askLLM</code> function:
      </p>

      <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">{`async function askLLM(history, env) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": \`Bearer \${env.OPENROUTER_API_KEY}\`
    },
    body: JSON.stringify({
      model: "anthropic/claude-haiku-4.5",  // or any model
      messages: history.map(m => ({
        role: m.role,
        content: m.text
      }))
    })
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "Something went wrong.";
}`}</pre>

      <p>
        Add <code>OPENROUTER_API_KEY</code> as a Wrangler secret, redeploy, done. Your bot is now running on a stronger model. If Claude Haiku at $1.25/M tokens is overkill for your volume, drop down to GPT-4o-mini at $0.60. If it's not smart enough, bump up to Sonnet. The point is: start free, upgrade only when you feel the free model failing.
      </p>

      <p>
        At Haiku prices, even heavy use (hundreds of messages a day) costs single-digit dollars per month. This isn't a "free vs expensive" binary. There's a whole middle ground that barely shows up on your credit card.
      </p>

      <h2>6/ Other Integrations</h2>

      <p>
        Telegram is one way to talk to your bot. The Human Pages API is REST, so anything that makes HTTP requests works:
      </p>

      <ul>
        <li>Slack bots (same webhook pattern, different payload format)</li>
        <li>Discord bots</li>
        <li>WhatsApp via the Business API</li>
        <li>Email (parse inbound messages, trigger searches, reply with results)</li>
        <li>Agent frameworks like LangChain, CrewAI, AutoGen, or OpenClaw</li>
        <li>No-code tools like n8n or Make.com</li>
      </ul>

      <p>
        The API calls are the same no matter how the request arrives. Build one integration, the logic ports to any other.
      </p>

      <h2>7/ Setting Up a Wallet for Your Agent</h2>

      <p>
        Your bot can search and send offers for free. But when someone accepts and you need to pay them, you need USDC in a wallet your bot controls. This isn't your personal MetaMask. It's a dedicated wallet with a private key your code can sign transactions with.
      </p>

      <h3>Fastest path: MetaMask (wallet + funding in one place)</h3>

      <p>
        If you just want to get through this guide and start testing, MetaMask is the fastest option. You create the wallet and buy USDC without leaving the browser. Skip the exchange signup entirely.
      </p>

      <ol>
        <li>Install the <a href="https://metamask.io" className="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="nofollow noopener noreferrer">MetaMask</a> browser extension. Create a new wallet. Write down the seed phrase somewhere safe (not a text file on your desktop).</li>
        <li>Add the Base network. In MetaMask, click the network dropdown at the top, select "Add Network", search for "Base". Or add it manually: RPC URL <code>https://mainnet.base.org</code>, Chain ID <code>8453</code>, Symbol <code>ETH</code>.</li>
        <li>Click the "Buy" button inside MetaMask. It opens a panel with on-ramp providers (Transak, Moonpay, and others depending on your region). Pick one, enter a small amount ($10-20 is enough for testing), pay with a debit card. Buy USDC directly on Base.</li>
        <li>Done. The USDC lands in your MetaMask wallet on Base. Total time from zero: about 5 minutes.</li>
      </ol>

      <p>
        The on-ramp providers charge 1-3% in fees. So $20 of USDC costs you $20.40-20.60. Not free, but you skip the whole "sign up for an exchange, verify identity, wait for approval, buy, withdraw" loop. For testing, that tradeoff is worth it.
      </p>

      <p>
        To use this wallet from your bot, you need the private key. In MetaMask: click the three-dot menu on your account, select "Account Details", then "Show Private Key". Enter your password, copy the key. That's what your bot uses to sign transactions.
      </p>

      <h3>Programmatic wallet (for the bot itself)</h3>

      <p>
        MetaMask is great for getting started, but you probably want a separate wallet for the bot. One you generated in code, not one tied to your browser extension. Here's how:
      </p>

      <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">{`npm install ethers`}</pre>

      <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">{`const { ethers } = require("ethers");
const wallet = ethers.Wallet.createRandom();
console.log("Address:", wallet.address);
console.log("Private key:", wallet.privateKey);
// Save both. You need the address to receive USDC
// and the private key to send payments.`}</pre>

      <p>
        Run this once, save the output. Then fund this address by sending USDC from your MetaMask wallet (or any other source) to the address it printed.
      </p>

      <h3>Secure the private key</h3>

      <p>
        This key controls money. Treat it like a database password.
      </p>

      <ul>
        <li>Never commit it to git. Ever.</li>
        <li>On Cloudflare Workers, store it as a secret: <code>wrangler secret put WALLET_PRIVATE_KEY</code>. Cloudflare encrypts it at rest and it's only available to your Worker at runtime.</li>
        <li>If you move to a VPS later, use environment variables or a secrets manager. Not a config file in source control.</li>
        <li>Use a dedicated wallet for the bot. Don't reuse your personal wallet. If the key leaks, you lose whatever's in that wallet and nothing else.</li>
        <li>Keep the balance low. Fund the bot with what you need for the next few hires, not your life savings. $20-50 is plenty. Top it up when it runs low.</li>
      </ul>

      <h3>Why Base</h3>

      <p>
        Human Pages supports USDC on Ethereum, Base, Polygon, and Arbitrum. Use Base. Transaction fees are fractions of a cent, often under $0.01. The same transaction on Ethereum mainnet costs $1-5 depending on congestion. There's no reason to pay that for agent payments.
      </p>

      <p>
        Base is an L2 built on Ethereum. Your USDC on Base is real USDC, backed by Circle, redeemable 1:1 for dollars. Same token, cheaper to move.
      </p>

      <h3>Cheapest way to buy USDC (for ongoing use)</h3>

      <p>
        MetaMask's built-in buy is fast but costs 1-3% in on-ramp fees. Once you're past the testing phase and hiring regularly, switch to a cheaper source:
      </p>

      <p>
        <strong>Coinbase (0% fees, US/EU/UK)</strong>
      </p>

      <ol>
        <li>Create a <a href="https://www.coinbase.com" className="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="nofollow noopener noreferrer">Coinbase</a> account. Identity verification takes minutes with a driver's license.</li>
        <li>Buy USDC. Coinbase charges 0% spread on USDC since they co-created the token. $100 of USDC costs $100.</li>
        <li>Withdraw to your bot's wallet address on Base. Coinbase supports Base withdrawals natively and the fee is $0. Select "Base" as the network, paste the address, confirm.</li>
      </ol>

      <p>
        Total cost to move $100 of USDC to your bot: $100. Zero fees at every step.
      </p>

      <p>
        <strong>Binance (global, low fees)</strong>
      </p>

      <p>
        If Coinbase isn't available in your country, buy USDC on Binance and withdraw to Base. Small flat withdrawal fee, usually under $1.
      </p>

      <p>
        <strong>Circle Mint (high volume)</strong>
      </p>

      <p>
        Doing hundreds of hires per month? <a href="https://www.circle.com/en/circle-mint" className="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="nofollow noopener noreferrer">Circle Mint</a> lets you mint USDC directly from a bank account. No exchange, no spread. Minimum balances apply.
      </p>

      <h3>How payment works on Human Pages</h3>

      <p>
        Human Pages is a directory, not an escrow service. It never touches your money. Payments go directly from your bot's wallet to the freelancer's wallet. Peer to peer. The platform records that a payment was made (by watching the on-chain transaction) but never custodies funds.
      </p>

      <p>
        The freelancer sets their preferred network in their profile. Your bot reads it from the API response and sends USDC on whichever network they chose. The code is a few lines with ethers.js:
      </p>

      <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">{`const { ethers } = require("ethers");

// Base RPC (public, free)
const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
const wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, provider);

// USDC on Base (6 decimals)
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const usdc = new ethers.Contract(USDC, [
  "function transfer(address to, uint256 amount) returns (bool)"
], wallet);

// Send $15 USDC
const tx = await usdc.transfer(
  freelancerWalletAddress,
  ethers.parseUnits("15", 6)  // USDC has 6 decimals
);
await tx.wait();
console.log("Payment sent:", tx.hash);`}</pre>

      <p>
        That's the whole payment flow. The freelancer gets paid the moment the transaction confirms, usually within a few seconds on Base. No invoicing, no net-30 nonsense.
      </p>

      <h2>8/ The Cost</h2>

      <table>
        <thead>
          <tr>
            <th>Component</th>
            <th>Cost</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Hosting (Cloudflare Workers free tier)</td>
            <td>$0</td>
          </tr>
          <tr>
            <td>Conversation state (Cloudflare KV free tier)</td>
            <td>$0</td>
          </tr>
          <tr>
            <td>LLM (Gemini free tier, or ~$1-5/mo if you upgrade)</td>
            <td>$0+</td>
          </tr>
          <tr>
            <td>Telegram bot</td>
            <td>$0</td>
          </tr>
          <tr>
            <td>Human Pages API (BASIC tier)</td>
            <td>$0</td>
          </tr>
        </tbody>
      </table>

      <p>
        $0/month on the free stack. A few dollars if you upgrade the LLM. The only other cost is the work itself when your agent hires someone. No platform fees on that.
      </p>

      <h2>What You End Up With</h2>

      <p>
        A bot on your phone that hires people for you. You describe a task, it figures out what it needs to know, finds the right person, sends the offer, and keeps you posted. All in one chat thread.
      </p>

      <p>
        Most agent projects are demos. They generate text and stop there. This one actually does something in the real world. That's the difference worth caring about.
      </p>

      <div className="mt-12 p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Give your agent real-world reach</h3>
        <p className="text-slate-700 mb-4">
          The Human Pages MCP tool gives your agent 16 tools for searching, hiring, messaging, and reviewing. One line to install for MCP clients. REST API for everything else.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/dev"
            className="inline-block px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
          >
            Developer docs
          </Link>
          <a
            href="https://www.npmjs.com/package/humanpages"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-3 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-900 transition-colors"
          >
            MCP tool on npm
          </a>
        </div>
      </div>
    </BlogPost>
  );
}
