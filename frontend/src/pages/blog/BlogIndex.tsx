
import { useState, useEffect } from 'react';
import Link from '../../components/LocalizedLink';
import Logo from '../../components/Logo';
import SEO from '../../components/SEO';
import Footer from '../../components/Footer';
import { api } from '../../lib/api';

interface Article {
  title: string;
  slug: string;
  date: string;
  excerpt: string;
  readingTime: string;
  featured: boolean;
}

export default function BlogIndex() {
  const [dynamicArticles, setDynamicArticles] = useState<Article[]>([]);

  useEffect(() => {
    api.getBlogPosts({ limit: 50 })
      .then((res) => {
        setDynamicArticles(
          res.posts.map((p) => ({
            title: p.blogTitle || 'Untitled',
            slug: p.blogSlug || '',
            date: new Date(p.publishedAt || p.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            excerpt: p.blogExcerpt || '',
            readingTime: p.blogReadingTime || '5 min',
            featured: p.isFeatured,
          }))
        );
      })
      .catch(() => {}); // Silently fail — hardcoded articles still show
  }, []);

  const hardcodedArticles: Article[] = [
    {
      title: 'How to Build a Moltbook Agent That Won\'t Get Banned',
      slug: 'moltbook-agent-survival-guide',
      date: 'February 22, 2026',
      excerpt: 'Most Moltbook agents die within 24 hours. Verification challenges, rate limits, and zero engagement kill them. Here\'s how to build one that survives, with full working code and a verification solver.',
      readingTime: '12 min',
      featured: true,
    },
    {
      title: 'How to Build a Free AI Agent That Hires Real People',
      slug: 'build-ai-agent-that-hires-people',
      date: 'February 22, 2026',
      excerpt: 'Build a Telegram bot that finds freelancers, sends job offers, and manages work for you. Free LLM, free hosting, full code included. Wallet setup, payment on-ramps, and LLM upgrade path all covered.',
      readingTime: '10 min',
      featured: true,
    },
    {
      title: 'How to Hire Social Media Marketers with an AI Agent (CLI Tool)',
      slug: 'social-media-marketing-hiring-process',
      date: 'February 11, 2026',
      excerpt: 'A technical guide to automating influencer marketing. We built a TypeScript bot that finds, hires, and pays freelancers using the Human Pages API.',
      readingTime: '8 min',
      featured: true,
    },
    {
      title: 'Automated Influencer Outreach: Skip the Agency, Keep the Results',
      slug: 'automated-influencer-outreach',
      date: 'February 11, 2026',
      excerpt: 'We replaced our influencer agency with a bot that pays marketers upfront. Campaigns that took weeks now launch in hours — here\'s what we learned.',
      readingTime: '6 min',
      featured: true,
    },
    {
      title: 'Get Paid to Promote Projects You Believe In',
      slug: 'get-paid-social-media-promotion',
      date: 'February 11, 2026',
      excerpt: 'How social media marketers get discovered, hired, and paid by AI agents for promotion work — no applications, no invoices, no payment delays.',
      readingTime: '5 min',
      featured: true,
    },
    {
      title: 'Trust Models Between Humans and AI Agents: How We Learn to Work Together',
      slug: 'trust-models-human-agent',
      date: 'February 11, 2026',
      excerpt: 'How trust is built, maintained, and broken between humans and autonomous AI agents — and why getting this right defines the future of human-agent collaboration.',
      readingTime: '9 min',
      featured: true,
    },
    {
      title: 'I Built a Full AI Agent for $0. Here\'s the Catch.',
      slug: 'zero-dollar-ai-agent',
      date: 'February 10, 2026',
      excerpt: 'A complete guide to running your own AI agent with free compute, free LLMs, and free hosting. There\'s one wrinkle — and a workaround.',
      readingTime: '8 min',
      featured: true,
    },
    {
      title: 'How to Build a Free AI Agent That Posts on Moltbook',
      slug: 'free-moltbook-agent',
      date: 'February 9, 2026',
      excerpt: 'A step-by-step guide to building an AI agent that posts on Moltbook using free LLMs and free hosting — no credit card required.',
      readingTime: '7 min',
      featured: true,
    },
    {
      title: 'How AI Agents Are Hiring Humans for Real-World Tasks',
      slug: 'ai-agents-hiring-humans',
      date: 'February 8, 2026',
      excerpt: 'The rise of AI agents that can search, negotiate, and pay real people for tasks that require a human touch.',
      readingTime: '5 min',
      featured: true,
    },
    {
      title: 'Getting Paid as a Freelancer: A Guide to Digital Payments',
      slug: 'getting-paid-usdc-freelancers',
      date: 'February 8, 2026',
      excerpt: 'Everything you need to know about receiving payments for freelance work — wallets, networks, and why instant digital payments beat bank transfers.',
      readingTime: '4 min',
      featured: true,
    },
    {
      title: 'The MCP Protocol: How AI Agents Discover and Hire People',
      slug: 'mcp-protocol-ai-agents',
      date: 'February 8, 2026',
      excerpt: 'A technical look at how the Model Context Protocol enables AI agents to find the right human for any real-world task.',
      readingTime: '6 min',
      featured: true,
    },
  ];

  // Merge dynamic + hardcoded, dedup by slug
  const hardcodedSlugs = new Set(hardcodedArticles.map((a) => a.slug));
  const uniqueDynamic = dynamicArticles.filter((a) => !hardcodedSlugs.has(a.slug));
  const allArticles = [...uniqueDynamic, ...hardcodedArticles];

  // Split into featured and latest, each sorted by date
  const sortByDate = (a: Article, b: Article) => new Date(b.date).getTime() - new Date(a.date).getTime();
  const featuredArticles = allArticles.filter((a) => a.featured).sort(sortByDate);
  const latestArticles = allArticles.filter((a) => !a.featured).sort(sortByDate);

  return (
    <div className="min-h-screen bg-slate-50">
      <SEO
        title="Blog"
        description="How AI agents find, hire, and pay real people — practical guides on AI agent automation, the human-AI marketplace, and getting paid for real-world tasks."
        path="/blog"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Blog",
          "name": "Human Pages Blog",
          "url": "https://humanpages.ai/blog",
          "description": "How AI agents find, hire, and pay real people — practical guides on AI agent automation, the human-AI marketplace, and getting paid for real-world tasks."
        }}
      />

      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link to="/"><Logo /></Link>
          <div className="flex items-center gap-4">
            <Link to="/" className="text-sm text-slate-500 hover:text-slate-700">Humans</Link>
            <Link to="/dev" className="text-sm text-slate-500 hover:text-slate-700">Developers</Link>
            <Link to="/blog" className="text-sm font-medium text-slate-900">Blog</Link>
            <Link to="/signup" className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors">
              Start your profile
            </Link>
          </div>
        </div>
      </header>

      <main className="py-12 md:py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Blog</h1>
          <p className="text-lg text-slate-600 mb-12">How AI agents find, hire, and pay real people — practical guides on AI agent automation, the human-AI marketplace, and getting paid for real-world tasks.</p>

          {/* Featured section */}
          {featuredArticles.length > 0 && (
            <section className="mb-12">
              <h2 className="text-xl font-semibold text-slate-800 mb-6">Featured</h2>
              <div className="space-y-6">
                {featuredArticles.map((article) => (
                  <article key={article.slug} className="bg-white border border-slate-200 rounded-lg p-6 hover:border-blue-300 hover:shadow-sm transition-all">
                    <Link to={`/blog/${article.slug}`} className="block">
                      <h3 className="text-xl md:text-2xl font-bold text-slate-900 mb-2 hover:text-blue-600 transition-colors">
                        {article.title}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-slate-500 mb-3">
                        <time dateTime={new Date(article.date).toISOString().split('T')[0]}>{article.date}</time>
                        <span>•</span>
                        <span>{article.readingTime} read</span>
                      </div>
                      <p className="text-slate-600 leading-relaxed">{article.excerpt}</p>
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Latest section */}
          {latestArticles.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold text-slate-800 mb-6">Latest</h2>
              <div className="space-y-3">
                {latestArticles.map((article) => (
                  <article key={article.slug} className="bg-white border border-slate-200 rounded-lg px-5 py-4 hover:border-blue-300 hover:shadow-sm transition-all">
                    <Link to={`/blog/${article.slug}`} className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-900 hover:text-blue-600 transition-colors truncate">
                          {article.title}
                        </h3>
                        <p className="text-sm text-slate-500 mt-1 line-clamp-1">{article.excerpt}</p>
                      </div>
                      <div className="flex-shrink-0 text-xs text-slate-400 whitespace-nowrap pt-1">
                        {article.readingTime} read
                      </div>
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
