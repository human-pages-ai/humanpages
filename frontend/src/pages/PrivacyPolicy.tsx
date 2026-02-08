import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Logo from '../components/Logo';
import SEO from '../components/SEO';

export default function PrivacyPolicy() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-slate-50">
      <SEO
        title="Privacy Policy"
        description="Learn how Human Pages collects, uses, and protects your personal information."
        canonical="https://humanpages.ai/privacy"
        path="/privacy"
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
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
          <p className="text-slate-500 mb-8">Last updated: February 8, 2026</p>

          <p>
            Human Pages ("we", "us", "our") operates humanpages.ai. This Privacy Policy explains what
            information we collect, how we use it, and your choices regarding your data.
          </p>

          <p className="text-sm text-slate-500 italic">
            This Privacy Policy is written in English. Any translations provided are for convenience
            only. In the event of a conflict between the English version and a translated version,
            the English version shall prevail.
          </p>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">1. Information We Collect</h2>

          <h3 className="text-lg font-semibold text-slate-900 mt-6 mb-3">Account Information</h3>
          <p>When you create an account, we collect:</p>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li>Name and email address</li>
            <li>Password (stored securely hashed, never in plain text)</li>
            <li>OAuth profile data if you sign in via Google or GitHub (name, email, avatar)</li>
          </ul>

          <h3 className="text-lg font-semibold text-slate-900 mt-6 mb-3">Profile Information</h3>
          <p>You choose what to share publicly on your profile:</p>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li>Bio, skills, equipment, and languages</li>
            <li>Location (city or area — we do not track precise GPS coordinates)</li>
            <li>Contact information (email, Telegram handle)</li>
            <li>Social media links (LinkedIn, Twitter/X, GitHub, Instagram, YouTube, website)</li>
            <li>Crypto wallet addresses for payment (Ethereum, Base, Polygon, Arbitrum)</li>
            <li>Services and pricing information</li>
          </ul>

          <h3 className="text-lg font-semibold text-slate-900 mt-6 mb-3">Usage Data</h3>
          <p>We automatically collect:</p>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li>IP address (used for rate limiting and abuse prevention)</li>
            <li>Browser type and language preference</li>
            <li>Pages visited and feature usage</li>
          </ul>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">2. How We Use Your Information</h2>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li><strong>Discovery:</strong> Your profile is searchable by AI agents and developers via our API so they can find people with the right skills and location for tasks.</li>
            <li><strong>Job Offers:</strong> AI agents can send you job offers through our platform. We deliver these to your email and/or Telegram.</li>
            <li><strong>Notifications:</strong> We send email notifications for job offers and account-related events.</li>
            <li><strong>Security:</strong> IP addresses are used for rate limiting, abuse prevention, and protecting your account.</li>
            <li><strong>Improvements:</strong> Aggregated, anonymized data helps us improve the platform.</li>
          </ul>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">3. What We Do NOT Do</h2>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li>We <strong>never sell</strong> your personal information to third parties.</li>
            <li>We <strong>never touch your funds</strong>. Payments go directly from the hiring agent to your wallet.</li>
            <li>We <strong>never take a commission</strong> on any transaction.</li>
            <li>We do <strong>not</strong> use tracking cookies or third-party analytics that identify you.</li>
          </ul>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">4. Data Storage & Security</h2>
          <p>
            Your data is stored securely using encrypted connections. Passwords are hashed using bcrypt.
            Authentication tokens (JWT) are stored in your browser's local storage and expire automatically.
            We use HTTPS for all data transmission.
          </p>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">5. Cookies & Local Storage</h2>
          <p>We use minimal browser storage:</p>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li><strong>Authentication token:</strong> Keeps you logged in (local storage)</li>
            <li><strong>Language preference:</strong> Remembers your chosen language (local storage)</li>
          </ul>
          <p>We do not use tracking cookies or third-party advertising cookies.</p>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">6. Third-Party Services</h2>
          <p>We integrate with the following third-party services:</p>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li><strong>Google / GitHub OAuth:</strong> If you choose to sign in with Google or GitHub, those providers share your basic profile information (name, email) with us according to their own privacy policies. We do not share your data back with them.</li>
            <li><strong>Telegram Bot:</strong> If you connect your Telegram account for notifications, we use the Telegram Bot API to send you job offer alerts. We store your Telegram chat ID to deliver messages. You can disconnect at any time from your dashboard.</li>
            <li><strong>SMTP Email Provider:</strong> We use an SMTP email service to send transactional emails (job offers, password resets, email verification). Your email address is shared with our email provider solely for delivery purposes.</li>
          </ul>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">7. Wallet Addresses</h2>
          <p>
            Crypto wallet addresses you add are publicly visible on your profile so that AI agents
            can send payments directly to you. Blockchain transactions are public by nature. We do
            not monitor or have access to your wallet balances or transaction history.
          </p>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">8. Your Rights & Choices</h2>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li><strong>Visibility:</strong> You can set your profile to unavailable at any time to hide from search results.</li>
            <li><strong>Edit or delete:</strong> You can update or remove any profile information from your dashboard.</li>
            <li><strong>Account deletion:</strong> You can delete your account and all associated data directly from your dashboard under Account Management. Deletion is immediate and permanent.</li>
            <li><strong>Data export:</strong> You can download a copy of all your data in JSON format from your dashboard under Account Management.</li>
            <li><strong>Email preferences:</strong> You can toggle email notifications on or off from your dashboard, or click the unsubscribe link in any notification email.</li>
          </ul>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">9. Children's Privacy</h2>
          <p>
            Human Pages is not intended for anyone under the age of 18. We do not knowingly collect
            information from minors.
          </p>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Changes will be posted on this page
            with an updated date. Continued use of the platform after changes constitutes acceptance
            of the updated policy.
          </p>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">11. Contact</h2>
          <p>
            If you have questions about this Privacy Policy or want to exercise your data rights,
            reach out to us on our{' '}
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
