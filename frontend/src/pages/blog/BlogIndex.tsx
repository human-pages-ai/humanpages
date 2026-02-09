
import Link from '../../components/LocalizedLink';
import Logo from '../../components/Logo';
import SEO from '../../components/SEO';
import Footer from '../../components/Footer';

interface Article {
  title: string;
  slug: string;
  date: string;
  excerpt: string;
  readingTime: string;
}

export default function BlogIndex() {


  const articles: Article[] = [
    {
      title: 'How to Build a Free AI Agent That Posts on Moltbook',
      slug: 'free-moltbook-agent',
      date: 'February 9, 2026',
      excerpt: 'A step-by-step guide to building an AI agent that posts on Moltbook using free LLMs and free hosting — no credit card required.',
      readingTime: '7 min',
    },
    {
      title: 'How AI Agents Are Hiring Humans for Real-World Tasks',
      slug: 'ai-agents-hiring-humans',
      date: 'February 8, 2026',
      excerpt: 'The rise of AI agents that can search, negotiate, and pay real people for tasks that require a human touch.',
      readingTime: '5 min',
    },
    {
      title: 'Getting Paid in USDC: A Freelancer\'s Guide to Crypto Payments',
      slug: 'getting-paid-usdc-freelancers',
      date: 'February 8, 2026',
      excerpt: 'Everything you need to know about receiving USDC payments for freelance work — wallets, networks, and why stablecoins beat bank transfers.',
      readingTime: '4 min',
    },
    {
      title: 'The MCP Protocol: How AI Agents Discover and Hire People',
      slug: 'mcp-protocol-ai-agents',
      date: 'February 8, 2026',
      excerpt: 'A technical look at how the Model Context Protocol enables AI agents to find the right human for any real-world task.',
      readingTime: '6 min',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <SEO
        title="Blog"
        description="Articles about AI agents, freelancing, crypto payments, and the future of work."
        path="/blog"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Blog",
          "name": "Human Pages Blog",
          "url": "https://humanpages.ai/blog",
          "description": "Articles about AI agents, freelancing, crypto payments, and the future of work."
        }}
      />

      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link to="/"><Logo /></Link>
          <div className="flex items-center gap-4">
            <Link to="/" className="text-sm text-slate-500 hover:text-slate-700">Humans</Link>
            <Link to="/dev" className="text-sm text-slate-500 hover:text-slate-700">Developers</Link>
            <Link to="/blog" className="text-sm font-medium text-slate-900">Blog</Link>
            <Link to="/signup" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
              Start your profile
            </Link>
          </div>
        </div>
      </header>

      <main className="py-12 md:py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Blog</h1>
          <p className="text-lg text-slate-600 mb-12">Articles about AI agents, freelancing, crypto payments, and the future of work.</p>

          <div className="space-y-6">
            {articles.map((article) => (
              <article key={article.slug} className="bg-white border border-slate-200 rounded-lg p-6 hover:border-blue-300 hover:shadow-sm transition-all">
                <Link to={`/blog/${article.slug}`} className="block">
                  <h2 className="text-xl md:text-2xl font-bold text-slate-900 mb-2 hover:text-blue-600 transition-colors">
                    {article.title}
                  </h2>
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
        </div>
      </main>

      <Footer />
    </div>
  );
}
