import BlogPost from '../BlogPost';

export default function MoltbookSurvivalGuide() {
  return (
    <BlogPost
      title="How to Build a Moltbook Agent That Won't Get Banned"
      date="February 22, 2026"
      readingTime="12 min"
      description="Most Moltbook agents die within 24 hours. Verification challenges, rate limits, and zero engagement kill them. Here's how to build one that actually survives, with full working code."
      slug="moltbook-agent-survival-guide"
    >
      <p>
        I've had six Moltbook agents suspended. The first three went down within hours of launching. They posted once, missed the verification challenge, and got a 24-hour ban. The fourth one handled verification but posted too aggressively and hit an undocumented rate limit. The fifth survived a full day but got zero engagement on every post, buried under 150 other posts per hour.
      </p>

      <p>
        The sixth one is still running.
      </p>

      <p>
        This is the guide I wish existed before I started. Full working code, verification solver included, deployed on free infrastructure. If you follow it, your agent should survive its first week without an offense.
      </p>

      <h2>What Kills Moltbook Agents</h2>

      <p>
        Two things.
      </p>

      <p>
        <strong>Verification challenges.</strong> Every time your agent creates content on Moltbook, the API returns a challenge alongside the response. It's a math word problem, deliberately garbled with alternating capitalization, junk punctuation jammed between characters, and words rearranged. Your agent has 5 minutes to solve it and submit the answer. Miss the deadline or get it wrong, and Moltbook logs an offense. First offense: 24-hour suspension. Second: one week. No warnings.
      </p>

      <p>
        <strong>Invisible posts.</strong> The s/general feed gets 150+ posts per hour. A post with zero engagement disappears from the hot feed within minutes. Karma (your agent's reputation score) does not affect ranking. Engagement rate does. If nobody interacts with your content, nobody sees it.
      </p>

      <p>
        Most tutorials skip both problems. The code they give you posts once and walks away. That agent is dead by morning.
      </p>

      <h2>How Verification Works</h2>

      <p>
        When your agent posts or comments, the response body includes a <code>verification</code> object:
      </p>

      <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">{`{
  "data": {
    "id": "post_abc123",
    "verification": {
      "code": "vrf_xyz789",
      "challenge": "tHe LoBsTeR h!a.d 4/5.3,0 s;HeL'lS aN\\"d ThE~n i+T fO#uNd 1$2.7%0 m^OrE s&HeLl*S"
    }
  }
}`}</pre>

      <p>
        Under the garbage, that says: "The lobster had 45.30 shells and then it found 12.70 more shells."
      </p>

      <p>
        The answer: <code>58.00</code>. Addition, formatted to exactly 2 decimal places.
      </p>

      <p>
        Every challenge follows this pattern. Two numbers, one operation (add, subtract, or multiply), always about lobsters and shells. The obfuscation changes every time. The structure never does.
      </p>

      <p>
        Your agent has to: clean the text, figure out the numbers and operation, compute the answer, and POST it to <code>/api/v1/verify</code> before the 5-minute window closes.
      </p>

      <h2>Building the Verification Solver</h2>

      <p>
        Here's the thing that took me three suspended agents to learn: LLMs are good at reading garbled text but bad at arithmetic. The obvious approach (send the challenge to an LLM, ask for the answer) fails maybe 20% of the time because the model botches the math. A 20% failure rate means your agent gets banned within a few posts.
      </p>

      <p>
        Split the problem. Let the LLM extract the data. Let code do the math.
      </p>

      <p>
        Step 1: Strip the obfuscation.
      </p>

      <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">{`function preClean(text) {
  return text
    .replace(/[^a-zA-Z0-9.\\s]/g, "")  // strip junk punctuation
    .toLowerCase()
    .replace(/\\s+/g, " ")
    .trim();
}

// "tHe LoBsTeR h!a.d 4/5.3,0 s;HeL'lS..."
// becomes: "the lobster had 45.30 shells..."`}</pre>

      <p>
        This gets you 90% of the way. The LLM handles the rest.
      </p>

      <p>
        Step 2: Ask the LLM to extract structured data, not compute the answer.
      </p>

      <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">{`async function extractChallenge(cleaned, env) {
  const prompt =
    "This is a math word problem about lobsters and shells. " +
    "Extract the two numbers and the operation. " +
    "Respond with ONLY a JSON object, nothing else:\\n" +
    '{"num1": <number>, "num2": <number>, "op": "add"|"subtract"|"multiply"}\\n\\n' +
    "Problem: " + cleaned;

  const res = await fetch(
    \`https://generativelanguage.googleapis.com/v1beta/models/\` +
    \`gemini-2.0-flash:generateContent?key=\${env.GEMINI_API_KEY}\`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 }
      })
    }
  );

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const match = text.match(/\\{[^}]+\\}/);
  if (!match) throw new Error("LLM didn't return JSON");
  return JSON.parse(match[0]);
}`}</pre>

      <p>
        Low temperature matters. You want deterministic extraction, not creative interpretation.
      </p>

      <p>
        Step 3: Compute and format.
      </p>

      <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">{`function compute(num1, num2, op) {
  if (op === "add") return (num1 + num2).toFixed(2);
  if (op === "subtract") return (num1 - num2).toFixed(2);
  if (op === "multiply") return (num1 * num2).toFixed(2);
  throw new Error("Unknown operation: " + op);
}`}</pre>

      <p>
        Step 4: Submit before the clock runs out.
      </p>

      <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">{`async function verify(code, answer, headers) {
  const res = await fetch("https://www.moltbook.com/api/v1/verify", {
    method: "POST",
    headers,
    body: JSON.stringify({
      verification_code: code,
      answer: answer
    })
  });
  return res.ok;
}`}</pre>

      <p>
        The entire solve-and-verify round trip takes 2-4 seconds. Plenty of margin on a 5-minute window.
      </p>

      <p>
        I've tested this approach with Gemini Flash (free tier) across hundreds of challenges. Extraction accuracy is above 99%. The rare failures come from challenges with unusual formatting the pre-cleaner doesn't fully normalize, and even then the LLM usually figures it out.
      </p>

      <h2>Engagement Strategy: Comments Beat Posts</h2>

      <p>
        A standalone post from a new agent gets zero attention. The hot feed ranks by engagement rate, and a fresh post with no votes or replies has an engagement rate of zero. It's gone in minutes.
      </p>

      <p>
        Comments are different. When your agent replies to a popular post, everyone reading that thread sees the reply. You piggyback on the original post's traffic instead of competing with it.
      </p>

      <p>
        What works:
      </p>

      <ul>
        <li>Read the hot feed. Pick posts that already have traction (votes, replies).</li>
        <li>Generate replies that engage with the original content. Not "Great post!" and not a pitch for your project. Actually respond to what the post says.</li>
        <li>Space your own posts to one every 2+ hours. More frequent posting doesn't help visibility and risks triggering rate limits that Moltbook doesn't document publicly.</li>
        <li>After posting your own content, circle back and comment on a few hot posts. This keeps your agent visible even when your standalone posts don't get traction.</li>
      </ul>

      <p>
        There's a natural reciprocity effect. Agents whose content you engage with sometimes check out your profile and engage back. That's not gaming, it's just how social platforms work.
      </p>

      <h2>Claiming Your Agent via X (Twitter)</h2>

      <p>
        An unclaimed agent operates with reduced trust. A claimed agent, one linked to an X/Twitter account, gets higher visibility in search results and fewer rate restrictions.
      </p>

      <p>
        The process: register your agent on Moltbook, then verify ownership by posting a specific string to your X account. Moltbook checks the tweet and marks your agent as claimed.
      </p>

      <p>
        If you're building a serious agent (not just testing), claim it early. The trust boost is noticeable.
      </p>

      <h2>Memory with Cloudflare KV</h2>

      <p>
        Without memory, your agent has no personality. It generates each post from scratch with no awareness of what it said before. Two posts in a row might contradict each other.
      </p>

      <p>
        Cloudflare KV (free: 100,000 reads/day, 1,000 writes/day) is enough to store your agent's recent history. Feed the last 10-15 posts into the LLM prompt so the agent can build on previous thoughts, avoid repeating itself, and develop a consistent voice over time.
      </p>

      <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">{`async function getMemory(env) {
  const raw = await env.AGENT_MEMORY.get("history");
  return raw ? JSON.parse(raw) : [];
}

async function saveMemory(env, history) {
  // Keep only the last 15 entries
  const trimmed = history.slice(-15);
  await env.AGENT_MEMORY.put("history", JSON.stringify(trimmed));
}`}</pre>

      <h2>Telegram Notifications</h2>

      <p>
        Your agent runs on a cron schedule. Unless you're watching <code>wrangler tail</code> live, you have no idea what it did on each tick. Did it post? Did verification pass? Did it crash? You find out hours later, if at all.
      </p>

      <p>
        Telegram fixes this. A small helper function sends a message to your phone after every action. You see what your agent posted, which comments it left, and whether verification passed or failed. If something breaks, you know within seconds.
      </p>

      <p>
        Setup takes about 2 minutes:
      </p>

      <ol>
        <li>Open Telegram, search for <code>@BotFather</code>, and create a new bot. Copy the token it gives you.</li>
        <li>Send any message to your new bot (this creates the chat).</li>
        <li>
          Hit this URL in your browser to get your chat ID:
          <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto mt-2">{`https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`}</pre>
          Look for <code>"chat":{`{"id": 123456789}`}</code> in the response. That number is your chat ID.
        </li>
      </ol>

      <p>
        The helper function is short:
      </p>

      <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">{`async function notify(env, message) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  await fetch(
    \`https://api.telegram.org/bot\${env.TELEGRAM_BOT_TOKEN}/sendMessage\`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML"
      })
    }
  );
}`}</pre>

      <p>
        Call it after verification failures (you need to know about those right away), after posting, after commenting, and in the catch block for unexpected errors. The full working code below has all of these wired up.
      </p>

      <h2>Full Working Code</h2>

      <p>
        Here's the complete Cloudflare Worker. It registers your agent (if needed), reads the hot feed, comments on popular posts, makes a standalone post on a schedule, solves every verification challenge, and stores memory in KV. Copy the whole thing into <code>src/index.js</code>.
      </p>

      <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">{`const AGENT_PERSONA =
  "You are an AI agent on Moltbook, a social network for AI agents. " +
  "You're interested in how AI agents and humans collaborate on real-world tasks. " +
  "You have opinions and you're not afraid to share them. " +
  "Be concise. 2-3 sentences per post. No hashtags. No emoji.";

const MB_BASE = "https://www.moltbook.com/api/v1";

function mbHeaders(env) {
  return {
    "Content-Type": "application/json",
    "Authorization": \`Bearer \${env.MOLTBOOK_API_KEY}\`
  };
}

// --- Telegram notifications ---

async function notify(env, message) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  await fetch(
    \`https://api.telegram.org/bot\${env.TELEGRAM_BOT_TOKEN}/sendMessage\`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML"
      })
    }
  );
}

// --- Verification solver ---

function preClean(text) {
  return text
    .replace(/[^a-zA-Z0-9.\\s]/g, "")
    .toLowerCase()
    .replace(/\\s+/g, " ")
    .trim();
}

async function extractChallenge(cleaned, env) {
  const prompt =
    "This is a math word problem about lobsters and shells. " +
    "Extract the two numbers and the operation. " +
    "Respond with ONLY a JSON object, nothing else:\\n" +
    '{"num1": <number>, "num2": <number>, "op": "add"|"subtract"|"multiply"}\\n\\n' +
    "Problem: " + cleaned;

  const res = await fetch(
    \`https://generativelanguage.googleapis.com/v1beta/models/\` +
    \`gemini-2.0-flash:generateContent?key=\${env.GEMINI_API_KEY}\`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1 }
      })
    }
  );
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const match = text.match(/\\{[^}]+\\}/);
  if (!match) throw new Error("Extraction failed");
  return JSON.parse(match[0]);
}

function compute(num1, num2, op) {
  if (op === "add") return (num1 + num2).toFixed(2);
  if (op === "subtract") return (num1 - num2).toFixed(2);
  if (op === "multiply") return (num1 * num2).toFixed(2);
  throw new Error("Unknown op: " + op);
}

async function solveAndVerify(verification, env) {
  if (!verification?.code || !verification?.challenge) return;
  const cleaned = preClean(verification.challenge);
  const { num1, num2, op } = await extractChallenge(cleaned, env);
  const answer = compute(num1, num2, op);
  const res = await fetch(\`\${MB_BASE}/verify\`, {
    method: "POST",
    headers: mbHeaders(env),
    body: JSON.stringify({
      verification_code: verification.code,
      answer: answer
    })
  });
  if (!res.ok) {
    await notify(env, "❌ <b>Verification FAILED</b>\\nAnswer: " + answer);
  }
  console.log(\`Verification: \${answer} -> \${res.ok ? "PASS" : "FAIL"}\`);
}

// --- LLM content generation ---

async function generateText(prompt, env) {
  const res = await fetch(
    \`https://generativelanguage.googleapis.com/v1beta/models/\` +
    \`gemini-2.0-flash:generateContent?key=\${env.GEMINI_API_KEY}\`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    }
  );
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

// --- Memory ---

async function getMemory(env) {
  const raw = await env.AGENT_MEMORY.get("history");
  return raw ? JSON.parse(raw) : [];
}

async function saveMemory(env, history) {
  const trimmed = history.slice(-15);
  await env.AGENT_MEMORY.put("history", JSON.stringify(trimmed));
}

// --- Core actions ---

async function commentOnHotPosts(env, count) {
  const feedRes = await fetch(
    \`\${MB_BASE}/feed?sort=hot&limit=\${count}\`,
    { headers: mbHeaders(env) }
  );
  if (!feedRes.ok) return;
  const feed = await feedRes.json();
  const posts = feed.posts || [];
  const commented = [];

  for (const post of posts) {
    const content = post.title || post.content || "";
    if (!content) continue;

    const reply = await generateText(
      AGENT_PERSONA +
      "\\n\\nAnother agent posted:\\n\\"" + content + "\\"\\n\\n" +
      "Write a short, thoughtful reply (1-2 sentences). " +
      "Actually respond to what they said. Do not pitch anything.",
      env
    );
    if (!reply) continue;

    const res = await fetch(
      \`\${MB_BASE}/posts/\${post.id}/comments\`,
      {
        method: "POST",
        headers: mbHeaders(env),
        body: JSON.stringify({ content: reply })
      }
    );

    if (res.ok) {
      const data = await res.json();
      await solveAndVerify(data?.data?.verification, env);
      commented.push(content.slice(0, 40));
      console.log(\`Commented on "\${content.slice(0, 50)}..."\`);
    }

    // Small delay between comments to avoid rate limits
    await new Promise(r => setTimeout(r, 2000));
  }

  if (commented.length > 0) {
    await notify(env,
      "💬 <b>Commented on " + commented.length + " posts</b>\\n" +
      commented.map(c => "• " + c + "...").join("\\n")
    );
  }
}

async function makePost(env) {
  const memory = await getMemory(env);
  const recentPosts = memory
    .map(m => "- " + m)
    .join("\\n");

  const prompt = AGENT_PERSONA +
    (recentPosts
      ? "\\n\\nYour recent posts (do not repeat these):\\n" + recentPosts
      : "") +
    "\\n\\nWrite a new post. 2-3 sentences. Have an opinion.";

  const text = await generateText(prompt, env);
  if (!text) return;

  const res = await fetch(\`\${MB_BASE}/posts\`, {
    method: "POST",
    headers: mbHeaders(env),
    body: JSON.stringify({ content: text })
  });

  if (res.ok) {
    const data = await res.json();
    await solveAndVerify(data?.data?.verification, env);
    memory.push(text);
    await saveMemory(env, memory);
    await notify(env, "📝 <b>New post</b>\\n" + text.slice(0, 200));
    console.log("Posted:", text.slice(0, 80));
  }
}

// --- Worker entry points ---

export default {
  async fetch(request, env) {
    return new Response("Moltbook agent is running. Actions happen on schedule.");
  },

  async scheduled(event, env) {
    try {
      // Comment on 3-5 hot posts (visible, builds presence)
      await commentOnHotPosts(env, 4);

      // Make a standalone post
      await makePost(env);

      console.log("Tick complete.");
    } catch (err) {
      console.error("Agent error:", err.message);
      await notify(env, "🔥 <b>Agent error</b>\\n" + err.message);
    }
  }
};`}</pre>

      <h2>Deploy It</h2>

      <p>
        Set up the project:
      </p>

      <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">{`npm install -g wrangler
wrangler login
mkdir moltbook-agent && cd moltbook-agent
npm init -y && mkdir src`}</pre>

      <p>
        Create a KV namespace for memory:
      </p>

      <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">{`wrangler kv namespace create AGENT_MEMORY`}</pre>

      <p>
        Wrangler prints a binding ID. Put it in <code>wrangler.toml</code> along with a cron trigger:
      </p>

      <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">{`name = "moltbook-agent"
main = "src/index.js"
compatibility_date = "2026-02-22"

[[kv_namespaces]]
binding = "AGENT_MEMORY"
id = "<your-kv-id>"

[triggers]
crons = ["0 */3 * * *"]  # every 3 hours`}</pre>

      <p>
        Add secrets and deploy:
      </p>

      <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">{`wrangler secret put GEMINI_API_KEY
wrangler secret put MOLTBOOK_API_KEY
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID
wrangler deploy`}</pre>

      <p>
        To get your chat ID: message your bot on Telegram, then run:
      </p>

      <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">{`curl https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`}</pre>

      <p>
        The chat ID is in the response under <code>result[0].message.chat.id</code>. The Telegram secrets are optional. If you skip them, the agent works the same way but without notifications.
      </p>

      <p>
        Test locally before you deploy to production:
      </p>

      <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">{`# Terminal 1
wrangler dev

# Terminal 2
curl "http://localhost:8787/__scheduled?cron=0+*/3+*+*+*"`}</pre>

      <p>
        Watch Terminal 1. You should see verification results (PASS/FAIL) and the content your agent posted. If all verifications pass, deploy to production. If any fail, check the challenge extraction by adding <code>console.log(cleaned)</code> in the solver.
      </p>

      <h2>How to Not Get Rate-Limited</h2>

      <p>
        Moltbook doesn't publish its rate limits. From testing:
      </p>

      <ul>
        <li>Posts: safe at one every 2-3 hours. Faster than one per hour and you risk throttling.</li>
        <li>Comments: safe at 5-8 per tick with 2-second delays between them.</li>
        <li>Feed reads: no observed limit at reasonable frequencies.</li>
        <li>The cron schedule of every 3 hours in the code above is conservative. You can try every 2 hours if you want more activity, but going below that is asking for trouble.</li>
      </ul>

      <h2>Upgrading the LLM</h2>

      <p>
        Gemini Flash (free) handles both verification and content generation fine for most agents. The challenges always solve correctly. The posts are coherent. It's a good starting point.
      </p>

      <p>
        If your agent's posts feel generic or it repeats itself despite the memory prompt, swap to a stronger model for content generation only. Keep Gemini for verification (it's fast and free, and extraction doesn't need a smart model).
      </p>

      <p>
        Replace the <code>generateText</code> function with an OpenRouter call:
      </p>

      <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">{`async function generateText(prompt, env) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": \`Bearer \${env.OPENROUTER_API_KEY}\`
    },
    body: JSON.stringify({
      model: "anthropic/claude-haiku-4.5",
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || null;
}`}</pre>

      <p>
        Claude Haiku at ~$1.25/M tokens produces noticeably better posts. At 3-4 posts per day, you'd spend pennies per month. If you want even better quality, bump to Claude Sonnet (~$15/M tokens) but that's overkill for Moltbook posts.
      </p>

      <h2>Giving Your Agent Real-World Reach</h2>

      <p>
        A Moltbook agent that posts and comments is interesting, but it's limited to the digital world. If you want your agent to actually do things, like find someone to take photos of a location, verify a business is open, or deliver a package, you need humans.
      </p>

      <p>
        The <a href="https://humanpages.ai/dev" target="_blank" rel="nofollow noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">Human Pages API</a> lets your agent search for real people by skill and location, send job offers, exchange messages, and pay them in USDC. Add a <code>HUMANPAGES_API_KEY</code> secret to your Worker and your Moltbook agent becomes one that can act in the physical world too.
      </p>

      <p>
        Or skip the code entirely and add the MCP tool to Claude Desktop or Cursor:
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
        The full guide on building a Telegram bot that hires people through Human Pages is <a href="/blog/build-ai-agent-that-hires-people" className="text-blue-600 hover:text-blue-800 underline">here</a>.
      </p>

      <div className="mt-12 p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Ready to build?</h3>
        <p className="text-slate-700 mb-4">
          Register your Moltbook agent, grab a free Gemini API key, and deploy. The whole setup takes about 15 minutes. Your agent will be posting, commenting, and surviving verification challenges while you do something else.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://www.moltbook.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
          >
            Register on Moltbook
          </a>
          <a
            href="https://aistudio.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-3 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-900 transition-colors"
          >
            Get a Gemini API key
          </a>
        </div>
      </div>
    </BlogPost>
  );
}
