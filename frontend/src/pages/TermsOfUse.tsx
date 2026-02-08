import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Logo from '../components/Logo';
import SEO from '../components/SEO';

export default function TermsOfUse() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-slate-50">
      <SEO
        title="Terms of Use"
        description="Read the terms and conditions for using Human Pages, the AI-to-human marketplace."
        canonical="https://humanpages.ai/terms"
        path="/terms"
      />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link to="/"><Logo /></Link>
          <Link
            to="/signup"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('nav.startProfile')}
          </Link>
        </div>
      </header>

      <main className="py-12 md:py-16 px-4">
        <article className="max-w-3xl mx-auto prose prose-slate">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Terms of Use</h1>
          <p className="text-slate-500 mb-8">Last updated: February 7, 2026</p>

          <p>
            Welcome to Human Pages. By using our platform at humanpages.ai, you agree to these
            Terms of Use. If you do not agree, please do not use the service.
          </p>

          <p className="text-sm text-slate-500 italic">
            These Terms of Use are written in English. Any translations provided are for convenience
            only. In the event of a conflict between the English version and a translated version,
            the English version shall prevail.
          </p>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">1. About the Service</h2>
          <p>
            Human Pages is a discovery platform that connects AI agents and developers with real
            people who can perform real-world tasks. We provide a searchable directory of human
            profiles — we are not a staffing agency, employer, or payment processor.
          </p>
          <p>
            We facilitate <strong>discovery only</strong>. All work arrangements, communications,
            and payments happen directly between the hiring party and the human.
          </p>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">2. Eligibility</h2>
          <p>
            You must be at least 18 years old to create an account. By using Human Pages, you
            represent that you meet this requirement and have the legal capacity to agree to
            these terms.
          </p>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">3. Your Account</h2>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li>You are responsible for keeping your login credentials secure.</li>
            <li>All information you provide must be accurate and truthful.</li>
            <li>You may not create multiple accounts or impersonate another person.</li>
            <li>You are responsible for all activity under your account.</li>
          </ul>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">4. Profile & Public Information</h2>
          <p>
            When you create a profile, the information you provide (name, bio, skills, location,
            contact details, wallet addresses, services) becomes publicly accessible through our
            website and API. This is by design — it allows AI agents and developers to find and
            contact you for tasks.
          </p>
          <p>
            You can control your visibility by toggling your availability status. When set to
            unavailable, your profile will not appear in search results.
          </p>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">5. Payments & Cryptocurrency</h2>
          <p>
            Human Pages does not process, hold, or facilitate payments. When you add wallet
            addresses to your profile, you enable hiring parties to pay you directly in
            cryptocurrency (USDC on Ethereum, Base, Polygon, or Arbitrum).
          </p>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li>We <strong>never hold or custody</strong> any funds.</li>
            <li>We <strong>do not charge commissions</strong> or platform fees on transactions.</li>
            <li>All payments are peer-to-peer between the hiring party and you.</li>
            <li>You are solely responsible for the security of your wallet and private keys.</li>
            <li>Cryptocurrency transactions are irreversible. We cannot reverse or refund payments.</li>
            <li>You are responsible for any tax obligations related to your earnings.</li>
          </ul>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">6. Job Offers</h2>
          <p>
            AI agents and developers may send you job offers through the platform. These offers
            include a task description and proposed payment. You are free to accept or decline
            any offer.
          </p>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li>Accepting an offer creates an agreement between you and the hiring party, not with Human Pages.</li>
            <li>We are not responsible for disputes between you and hiring parties.</li>
            <li>You can configure offer filters to automatically reject offers below your minimum price or rate.</li>
          </ul>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">7. API & Developer Access</h2>
          <p>
            We provide an API and MCP server for AI agents and developers to search the directory
            and interact with the platform programmatically. API users must:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li>Respect rate limits and not abuse the service.</li>
            <li>Not scrape, bulk-download, or redistribute the directory data.</li>
            <li>Not use the API to send spam, fraudulent offers, or harass users.</li>
            <li>Use API keys responsibly and not share them publicly.</li>
          </ul>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">8. Prohibited Conduct</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li>Provide false or misleading information on your profile.</li>
            <li>Use the platform for illegal activities.</li>
            <li>Send spam, fraudulent, or abusive job offers.</li>
            <li>Attempt to hack, disrupt, or exploit the service.</li>
            <li>Scrape or harvest user data for unauthorized purposes.</li>
            <li>Impersonate other users or entities.</li>
          </ul>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">9. Limitation of Liability</h2>
          <p>
            Human Pages is provided "as is" without warranties of any kind. To the fullest
            extent permitted by law:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li>We are not liable for any disputes, losses, or damages arising from interactions between users and hiring parties.</li>
            <li>We are not liable for lost cryptocurrency, failed transactions, or wallet security issues.</li>
            <li>We do not guarantee the accuracy of user profiles or the quality of work performed.</li>
            <li>We do not guarantee continuous, uninterrupted access to the service.</li>
          </ul>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">10. Account Termination</h2>
          <p>
            We may suspend or terminate your account if you violate these terms or engage in
            prohibited conduct. You may delete your account at any time by contacting us.
          </p>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">11. Intellectual Property</h2>
          <p>
            You retain ownership of all content you post on your profile. By creating a profile,
            you grant Human Pages a license to display and distribute your profile information
            through the website and API for the purpose of providing the service.
          </p>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">12. Changes to These Terms</h2>
          <p>
            We may update these Terms of Use from time to time. Changes will be posted on this
            page with an updated date. Continued use of the platform after changes constitutes
            acceptance of the updated terms.
          </p>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">13. Contact</h2>
          <p>
            If you have questions about these Terms of Use, reach out to us on our{' '}
            <a
              href="https://facebook.com/humanpages"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700"
            >
              Facebook page
            </a>.
          </p>
        </article>
      </main>

      {/* Footer */}
      <footer className="py-8 bg-white border-t border-slate-200 px-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="text-slate-500 text-sm">{t('landing.footer.copyright')}</span>
          <div className="flex gap-6 text-sm">
            <Link to="/privacy" className="text-slate-500 hover:text-slate-700">{t('landing.footer.privacy')}</Link>
            <Link to="/terms" className="text-slate-500 hover:text-slate-700">{t('landing.footer.terms')}</Link>
            <Link to="/dev" className="text-slate-500 hover:text-slate-700">{t('landing.footer.api')}</Link>
            <a href="https://facebook.com/humanpages" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-700">{t('landing.footer.contact')}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
