
import Link from '../../components/LocalizedLink';
import Logo from '../../components/Logo';
import SEO from '../../components/SEO';
import Footer from '../../components/Footer';

interface BlogPostProps {
  title: string;
  date: string;
  readingTime: string;
  description: string;
  slug: string;
  children: React.ReactNode;
}

export default function BlogPost({ title, date, readingTime, description, slug, children }: BlogPostProps) {


  return (
    <div className="min-h-screen bg-slate-50">
      <SEO
        title={title}
        description={description}
        path={`/blog/${slug}`}
        ogImage={`https://humanpages.ai/api/og/blog/${slug}?v=2`}
        ogType="article"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": title,
          "description": description,
          "datePublished": new Date(date).toISOString(),
          "author": {
            "@type": "Organization",
            "name": "Human Pages"
          },
          "publisher": {
            "@type": "Organization",
            "name": "Human Pages",
            "url": "https://humanpages.ai"
          }
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
        <div className="max-w-3xl mx-auto">
          <Link to="/blog" className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 mb-6">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Blog
          </Link>

          <article className="prose prose-slate prose-lg max-w-none prose-headings:scroll-mt-20 prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-code:before:content-none prose-code:after:content-none prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-slate-800 prose-code:text-[0.875em]">
            <header className="not-prose mb-10">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 leading-tight mb-4">{title}</h1>
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <time dateTime={new Date(date).toISOString().split('T')[0]}>{date}</time>
                <span>·</span>
                <span>{readingTime} read</span>
              </div>
            </header>

            {children}
          </article>
        </div>
      </main>

      <Footer />
    </div>
  );
}
