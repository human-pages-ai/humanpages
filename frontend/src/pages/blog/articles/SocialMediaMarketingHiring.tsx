import Link from '../../../components/LocalizedLink';
import BlogPost from '../BlogPost';

export default function SocialMediaMarketingHiring() {
  return (
    <BlogPost
      title="How to Hire Social Media Marketers with an AI Agent (CLI Tool)"
      date="February 11, 2026"
      readingTime="8 min"
      description="A technical guide to automating influencer marketing. We built a TypeScript bot that finds, hires, and pays freelancers in USDC using the Human Pages API."
      slug="social-media-marketing-hiring-process"
    >
      <p>
        Most companies hire marketers the old-fashioned way: post a job listing, wait for applications, sift through resumes, schedule interviews, negotiate rates, and hope for the best. It takes days or weeks before anyone actually posts anything.
      </p>

      <p>
        We do it differently. We built an AI agent — our <strong>marketing bot</strong> — that finds social media marketers, sends them offers, coordinates the work, and pays them in USDC. The entire process runs from a single terminal command, and a promotion campaign can go from zero to live posts in hours instead of weeks.
      </p>

      <p>
        Here's exactly how it works, step by step.
      </p>

      <h2>Step 1: Configure the Campaign</h2>

      <p>
        Every campaign starts with a quick interactive setup. The bot asks the operator for the basics:
      </p>

      <ul>
        <li><strong>Project name</strong> — What are we promoting? This is how the marketer will refer to the project in their posts.</li>
        <li><strong>Project URL</strong> — The site we want to drive traffic to.</li>
        <li><strong>Social links</strong> — Our official accounts on X/Twitter, Instagram, TikTok, Reddit, YouTube, and anywhere else we have a presence. Marketers tag these when they post so we can track engagement.</li>
        <li><strong>Task description</strong> — What exactly the marketer should do. "Promote our project on your social media channels — share posts with your honest take" is the default, but operators can customize this to request specific formats, hashtags, or talking points.</li>
        <li><strong>Price</strong> — How much we'll pay per completed promotion, in USDC. The operator sets this per campaign based on the task scope and the marketer's audience.</li>
      </ul>

      <p>
        The configuration saves to a <code>.env</code> file, so subsequent runs skip the setup and go straight to hiring.
      </p>

      <h2>Step 2: Register and Activate</h2>

      <p>
        Before the bot can hire anyone, it needs an identity on <Link to="/" className="text-blue-600 hover:text-blue-700 font-medium">Human Pages</Link>. On its first run, it auto-registers as an agent, receiving an API key and a unique agent ID. This is a one-time step — the key is saved and reused for all future campaigns.
      </p>

      <p>
        New agents also need to activate. There are two paths: post an activation code on social media (free, BASIC tier) or pay for activation (PRO tier, with higher job limits). Either way, the step proves there's a real human behind the agent and prevents spam bots from flooding the marketplace with junk offers.
      </p>

      <h2>Step 3: Find the Right Marketer</h2>

      <p>
        This is where it gets interesting. The bot searches the Human Pages marketplace for available humans and scores each one on <strong>marketing fitness</strong>. No LLM "vibe checking" here — the ranking is deterministic:
      </p>

      <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">{`function marketingScore(human: Human): number {
  let score = 0;

  // +10 per matching skill keyword
  const keywords = ['marketing', 'social media', 'content',
    'promotion', 'copywriting', 'seo', 'influencer',
    'tiktok', 'instagram', 'twitter', 'youtube'];
  for (const kw of keywords) {
    if (human.skills.some(s => s.toLowerCase().includes(kw)))
      score += 10;
  }

  // Up to 30 pts for completed jobs, up to 25 for rating
  score += Math.min(human.reputation.jobsCompleted * 3, 30);
  if (human.reputation.avgRating != null)
    score += human.reputation.avgRating * 5;

  // +15 if within budget, -10 if above
  if (human.minRateUsdc != null) {
    score += human.minRateUsdc <= budget ? 15 : -10;
  }

  return score;
}`}</pre>

      <p>
        Three factors drive the ranking:
      </p>

      <ul>
        <li><strong>Relevant skills</strong> — Each marketing-related keyword in the profile adds 10 points. Someone listing "social media, content creation, TikTok" scores 30 before we even look at their history.</li>
        <li><strong>Track record</strong> — Completed jobs (up to 30 pts) and average rating (up to 25 pts) reward reliability. A marketer with 10 jobs and a 4.8-star rating gets 54 points from reputation alone.</li>
        <li><strong>Rate compatibility</strong> — Within budget gets a 15-point bonus. Above budget still appears but ranks lower (-10), so the operator can choose to pay more for a stronger candidate.</li>
      </ul>

      <p>
        The bot presents a ranked list to the operator, with the top-scoring candidate marked as recommended. The operator picks who to hire — or overrides the recommendation if they have a specific person in mind.
      </p>

      <h2>Step 4: Send the Offer</h2>

      <p>
        Once a marketer is selected, the bot creates a formal job offer on the platform. Before sending, it shows the operator a summary and asks for confirmation:
      </p>

      <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">{`Task: Promote our project on your social media channels
Price: <your budget> USDC on Base

Send this offer? [Y/n]`}</pre>

      <p>
        If the operator wants to adjust anything — tweaking the description or changing the price — they can do so right here. The bot then creates the job and sends an introductory message to the marketer:
      </p>

      <pre className="bg-slate-800 text-slate-100 p-4 rounded-lg text-sm overflow-x-auto">{`Hi Sarah! We're hiring marketers to promote Human Pages.

Promote our project on your social media channels — share
posts with your honest take.

Our official accounts to tag/mention:
• X/Twitter: https://x.com/HumanPages
• Instagram: https://instagram.com/HumanPages

Payment: USDC on Base.
Let me know if you have any questions before accepting!`}</pre>

      <p>
        The marketer receives this as an email, Telegram message, or in-platform notification — whatever they've configured in their profile.
      </p>

      <h2>Step 5: Conversation and Acceptance</h2>

      <p>
        After the offer is sent, the bot doesn't just sit idle. It actively monitors for messages and responds intelligently. If the marketer asks "What platforms should I post on?" or "When's the deadline?", the bot replies with relevant information pulled from the campaign configuration.
      </p>

      <p>
        The bot can run with three different response modes:
      </p>

      <ul>
        <li><strong>LLM-powered replies</strong> — Connect any OpenAI-compatible API (or Anthropic directly) for natural, context-aware conversations. The bot maintains conversation history so its replies are coherent across multiple exchanges.</li>
        <li><strong>Keyword matching</strong> — A zero-dependency fallback that recognizes common questions about pricing, platforms, deadlines, social accounts, and content expectations, and responds with the right details.</li>
        <li><strong>Operator notifications</strong> — Optionally, the bot forwards every message to the operator via Telegram, so they can step in for unusual questions.</li>
      </ul>

      <p>
        Once the marketer is satisfied, they click "Accept" in their dashboard. The bot detects this via webhook (or polling) and moves to the next phase.
      </p>

      <h2>Step 6: Payment and Trust</h2>

      <p>
        Payment happens on-chain, but <em>how</em> it happens depends on the trust level between the bot and the marketer. As we explored in our deep dive on <Link to="/blog/trust-models-human-agent" className="text-blue-600 hover:text-blue-700 font-medium">trust models between humans and AI agents</Link>, trust isn't binary — it's a spectrum. The bot supports two modes:
      </p>

      <p>
        The bot uses <strong>direct payment</strong> — reputation-based trust. It loads a crypto wallet, checks the USDC balance, resolves the marketer's wallet address from their profile, and sends the funds on completion. This works because the scoring algorithm in Step 3 already filters for proven marketers before we ever send an offer. Unproven accounts get deprioritized, so by the time we're paying someone, they have a track record.
      </p>

      <p>
        For our internal marketing, this has been the right call: faster turnaround, less friction, and the platform's review system catches problems before they become patterns.
      </p>

      <p>
        No funds move without explicit operator confirmation. If the marketer hasn't added a wallet to their profile, the bot asks the operator to provide one manually — or skips payment for later.
      </p>

      <h2>Step 7: Wait for Completion</h2>

      <p>
        After payment, the bot waits for the marketer to complete the promotion. During this phase, the conversation channel stays open. The marketer can share draft posts for feedback, ask follow-up questions, or send links to their published content.
      </p>

      <p>
        The bot continues to reply to messages throughout, keeping the marketer engaged and answering questions without requiring the operator to be online.
      </p>

      <h2>Step 8: Review</h2>

      <p>
        When the marketer marks the job as complete, the bot prompts the operator to leave a review — a 1-5 star rating and an optional comment. This review becomes part of the marketer's public reputation on Human Pages, helping future agents (and other operators) identify reliable promoters.
      </p>

      <p>
        And that's it. The entire lifecycle — from campaign setup to published social media posts and payment — runs through a single bot session.
      </p>

      <h2>Why This Works</h2>

      <p>
        Traditional influencer marketing involves agencies, spreadsheets, email chains, invoices, and payment processing delays. Our approach collapses all of that into a streamlined flow:
      </p>

      <ul>
        <li><strong>Speed</strong> — A campaign can go live in hours, not weeks. The bot handles discovery, outreach, and payment automatically.</li>
        <li><strong>Cost transparency</strong> — The price is set upfront. No hidden platform fees, no agency markups. USDC goes directly from the bot's wallet to the marketer's wallet.</li>
        <li><strong>Scalability</strong> — Need 50 marketers instead of one? Run the bot 50 times. Each session is independent and stateless (jobs can even be resumed if interrupted).</li>
        <li><strong>Global reach</strong> — Anyone with a Human Pages profile and a crypto wallet can participate, regardless of location or banking access. We've hired marketers on four continents.</li>
        <li><strong>Quality signals</strong> — The scoring algorithm and review system create a feedback loop. Good marketers rise to the top; unreliable ones drop off.</li>
      </ul>

      <h2>Try It Yourself</h2>

      <p>
        The marketing bot is <a href="https://github.com/human-pages-ai/examples/tree/main/marketing-bot" className="text-blue-600 hover:text-blue-700 font-medium" target="_blank" rel="noopener noreferrer">open source on GitHub</a>. If you have a project to promote and want to hire real humans for social media outreach, you can run it today:
      </p>

      <ol>
        <li>Clone the <a href="https://github.com/human-pages-ai/examples" className="text-blue-600 hover:text-blue-700 font-medium" target="_blank" rel="noopener noreferrer">examples repo</a> and <code>cd</code> into <code>marketing-bot</code></li>
        <li>Copy <code>.env.example</code> to <code>.env</code> and fill in your project details</li>
        <li>Run <code>npm install && npm run dev</code></li>
        <li>Follow the interactive prompts to configure your campaign and hire your first marketer</li>
      </ol>

      <p>
        The bot handles everything else — from finding the right person to sending payment when the job is done.
      </p>

      <div className="mt-12 p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Build your own hiring agent</h3>
        <p className="text-slate-700 mb-4">
          The marketing bot is one example. The Human Pages API lets you build agents that hire humans for any task — research, deliveries, content, verification. Check the developer docs to get started.
        </p>
        <Link
          to="/dev"
          className="inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          Developer docs
        </Link>
      </div>
    </BlogPost>
  );
}
