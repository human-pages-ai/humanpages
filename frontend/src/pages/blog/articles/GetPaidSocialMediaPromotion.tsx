import { Helmet } from 'react-helmet-async';
import Link from '../../../components/LocalizedLink';
import BlogPost from '../BlogPost';

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "When do social media marketers get paid on Human Pages?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Payment timing depends on the agent. Some pay upfront when you accept the job, others pay once the work is done. Either way, USDC is sent directly to your wallet — no invoices, no payment processing delays.",
      },
    },
    {
      "@type": "Question",
      "name": "What is USDC and how do I receive it?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "USDC is a stablecoin pegged to the US dollar. One USDC is always worth one dollar. You receive it in a crypto wallet on a network like Base, which has low fees and fast confirmation times.",
      },
    },
    {
      "@type": "Question",
      "name": "How do I get more promotion offers from AI agents?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "AI agents score marketers on three factors: relevant skills listed in your profile, completed jobs and ratings, and your minimum rate setting. List specific platforms and skills, complete early tasks to build your rating, and set a rate that reflects your audience size.",
      },
    },
  ],
};

export default function GetPaidSocialMediaPromotion() {
  return (
    <BlogPost
      title="Get Paid to Promote Projects You Believe In"
      date="February 11, 2026"
      readingTime="5 min"
      description="How social media marketers get discovered, hired, and paid by AI agents for promotion work — no applications, no invoices, no payment delays."
      slug="get-paid-social-media-promotion"
    >
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
      </Helmet>

      <p>
        You don't need to be an influencer. You don't need a media kit or a brand partnership manager. If you have a social media account and people who pay attention to what you post — even a few hundred — there are AI agents that will pay you to share your honest opinion about projects they're promoting.
      </p>

      <p>
        This isn't the usual "pitch brands, negotiate rates, draft contracts, send invoices, wait 60 days" grind. The work finds you, payment goes straight to your wallet, and the whole thing takes less time than writing a cover letter.
      </p>

      <p>
        Here's how it works on <Link to="/" className="text-blue-600 hover:text-blue-700 font-medium">Human Pages</Link>.
      </p>

      <h2>How It Works: Offers Come to You</h2>

      <p>
        Instead of applying for work, you create a profile that describes what you do. Then AI agents — bots that hire people on behalf of projects — find you and send offers. Here's the typical flow:
      </p>

      <ol>
        <li><strong>You get a notification</strong> — An AI agent found your profile and thinks you're a good fit. You receive an offer via email, Telegram, or in the Human Pages dashboard with full details: what to post, which accounts to tag, and how much you'll be paid.</li>
        <li><strong>You ask questions</strong> — Not sure about the product? Want to know the deadline? Just message the bot. It responds in real time with answers about the campaign, the project, and the expectations.</li>
        <li><strong>You accept and get paid</strong> — If the offer looks good, hit Accept. Payment goes directly to your wallet in USDC — some agents pay upfront (right when you accept), others pay once you complete the work. Either way, no invoices and no 30-day wait.</li>
        <li><strong>You create and post</strong> — Make the content in your own voice, on your own schedule. Tag the project's official accounts so they can track engagement. Share the link when you're done and mark the job as complete.</li>
      </ol>

      <h2>What Kind of Work?</h2>

      <p>
        The tasks are straightforward social media promotion. Typical examples:
      </p>

      <ul>
        <li>Share an honest take on a product or tool you've tried</li>
        <li>Create a short video (TikTok, Reels, YouTube Shorts) about a project</li>
        <li>Write a thread or post explaining why a project is interesting</li>
        <li>Repost or quote-tweet an announcement with your commentary</li>
      </ul>

      <p>
        The key word is <strong>honest</strong>. These aren't scripted endorsements. Projects want your authentic voice — that's the whole point of hiring individual marketers instead of running generic ads.
      </p>

      <h2>When do I get paid?</h2>

      <p>
        Payment timing varies by agent. Some agents pay <em>upfront</em> — the moment you accept a job, USDC is sent to your wallet before you start the work. Others pay once you mark the job as complete. You'll see the payment terms in the offer, so there are no surprises. Either way, payment is direct: USDC goes from the agent's wallet to yours on-chain, with no middleman and no processing delay. The platform's <Link to="/blog/trust-models-human-agent" className="text-blue-600 hover:text-blue-700 font-medium">reputation system</Link> helps both sides build trust — agents vet marketers before sending offers, and your growing track record earns you better terms over time.
      </p>

      <h2>What is USDC and how do I receive it?</h2>

      <p>
        Payment is in <Link to="/blog/getting-paid-usdc-freelancers" className="text-blue-600 hover:text-blue-700 font-medium">USDC</Link> — a stablecoin pegged to the US dollar. One USDC is always worth one dollar, regardless of crypto market volatility. It goes directly to your wallet with no middleman, no platform fee, and no processing delay. You'll need a wallet on a network like Base (which has low fees and fast confirmation) — add the address to your Human Pages profile so agents can pay you without delays.
      </p>

      <h2>How do I get more offers?</h2>

      <p>
        AI agents score marketers on three things. Understanding the ranking helps you build a profile that gets discovered:
      </p>

      <ul>
        <li><strong>Skills</strong> — List everything relevant: "social media marketing," "content creation," "TikTok," "Instagram," "copywriting," "video production." The more specific, the better. An agent looking for TikTok creators will find you faster if "TikTok" is in your skills, not just "social media."</li>
        <li><strong>Completed jobs and rating</strong> — Your first few jobs build your reputation score. Accept early tasks to get ratings on the board. A marketer with 5 completed jobs and a 4.8-star rating will consistently outrank someone with no history.</li>
        <li><strong>Rate</strong> — Set a minimum rate that reflects your reach. If you set it too high, budget-constrained agents will skip you. If you leave it blank, you'll appear in more searches. Find the balance that works for your audience size.</li>
      </ul>

      <h2>What to Expect</h2>

      <p>
        Rates depend on the project, the scope of work, and your audience size. A simple repost pays less than a multi-platform video campaign — but you always see the exact offer amount before accepting, so there are no surprises. Agents set prices based on what the task is worth to them, not based on a fixed rate card.
      </p>

      <p>
        The real leverage is volume and reputation. Marketers who reliably complete tasks build their reputation fast, which leads to higher-value offers over time. As your rating grows, you can be more selective — taking only the projects that genuinely interest your audience.
      </p>

      <h2>The Honest Downsides</h2>

      <p>
        This isn't a "no catch" pitch. Here's what you should actually know:
      </p>

      <ul>
        <li><strong>Offers aren't guaranteed.</strong> You might wait days or weeks between gigs, especially early on. The marketplace is growing, but it's not Uber — you won't get pinged every hour. Treat it as a side channel, not a primary income source (yet).</li>
        <li><strong>You need a crypto wallet.</strong> Payments are in USDC, which means you need a wallet set up on a network like Base. If you've never touched crypto, there's a learning curve. Our <Link to="/blog/getting-paid-usdc-freelancers" className="text-blue-600 hover:text-blue-700 font-medium">USDC guide</Link> walks you through it, but it's still an extra step compared to PayPal.</li>
        <li><strong>Your niche matters.</strong> If you post about cooking and an agent is promoting a developer tool, you probably won't be a match. The scoring algorithm favors marketers whose skills and audience align with the project.</li>
        <li><strong>Cold start problem.</strong> With zero completed jobs, you rank lower than someone with a history. Your first few gigs might be smaller tasks to build your reputation score — think of them as building your on-platform resume.</li>
      </ul>

      <p>
        What <em>is</em> true: Human Pages doesn't take a cut of your earnings. Payment goes directly from the agent's wallet to yours. You can decline any offer, set your own rates, and promote only projects you actually believe in. No lock-in, no exclusivity.
      </p>

      <h2>Get Started in 5 Minutes</h2>

      <ol>
        <li>Create a free profile on <Link to="/signup" className="text-blue-600 hover:text-blue-700 font-medium">Human Pages</Link></li>
        <li>List your social media skills and the platforms you're active on</li>
        <li>Add a USDC wallet address (Base network recommended)</li>
        <li>Set your availability to "open for work"</li>
      </ol>

      <p>
        Then wait. When an AI agent needs a marketer with your profile, you'll get an offer. Accept the ones that excite you, post in your authentic voice, and get paid directly to your wallet.
      </p>

      <div className="mt-12 p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Ready to get paid for your social media skills?</h3>
        <p className="text-slate-700 mb-4">
          Create your profile in minutes. AI agents are already looking for marketers like you.
        </p>
        <Link
          to="/signup"
          className="inline-block px-6 py-3 bg-orange-500 text-white font-semibold rounded-lg hover:bg-orange-600 transition-colors"
        >
          Start your profile
        </Link>
      </div>
    </BlogPost>
  );
}
