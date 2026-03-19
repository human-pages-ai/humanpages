import { ReactNode } from 'react';
import Link from '../../components/LocalizedLink';
import Logo from '../../components/Logo';
import SEO from '../../components/SEO';
import Footer from '../../components/Footer';
import LanguageSwitcher from '../../components/LanguageSwitcher';

interface Breadcrumb {
  label: string;
  href?: string;
}

interface ConnectLayoutProps {
  children: ReactNode;
  title: string;
  description: string;
  path: string;
  breadcrumbs: Breadcrumb[];
}

export default function ConnectLayout({ children, title, description, path, breadcrumbs }: ConnectLayoutProps) {
  return (
    <div className="min-h-screen bg-white">
      <SEO
        title={title}
        description={description}
        path={path}
        ogType="article"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'TechArticle',
          headline: title,
          description,
          url: `https://humanpages.ai${path}`,
        }}
      />

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo className="h-7 w-auto" />
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/dev" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
              Developers
            </Link>
            <Link to="/dev/connect" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
              Connect
            </Link>
            <LanguageSwitcher />
          </div>
        </div>
      </nav>

      {/* Breadcrumbs */}
      <div className="pt-14">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-1.5 text-sm text-slate-500">
            <Link to="/dev" className="hover:text-slate-700 transition-colors">Developers</Link>
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span className="text-slate-300">/</span>
                {crumb.href ? (
                  <Link to={crumb.href} className="hover:text-slate-700 transition-colors">{crumb.label}</Link>
                ) : (
                  <span className="text-slate-900 font-medium">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 pb-20">
        {children}
      </main>

      <Footer />
    </div>
  );
}
