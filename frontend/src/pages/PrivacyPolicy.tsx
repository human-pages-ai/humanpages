import { useTranslation } from 'react-i18next';
import Link from '../components/LocalizedLink';
import Logo from '../components/Logo';
import SEO from '../components/SEO';
import Footer from '../components/Footer';

export default function PrivacyPolicy() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-slate-50">
      <SEO
        title="Privacy Policy"
        description="Learn how Human Pages collects, uses, and protects your personal information."
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
          <p className="text-slate-500 mb-8">Last updated: February 9, 2026</p>

          <p>
            Human Pages ("we", "us", "our") operates humanpages.ai. This Privacy Policy explains what
            information we collect, how we use it, the legal basis for processing, and your choices
            regarding your data.
          </p>

          <p className="text-sm text-slate-500 italic">
            This Privacy Policy is written in English. Any translations provided are for convenience
            only. In the event of a conflict between the English version and a translated version,
            the English version shall prevail.
          </p>

          {/* Section 1: Information We Collect */}
          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">1. Information We Collect</h2>

          <h3 className="text-lg font-semibold text-slate-900 mt-6 mb-3">Account Information</h3>
          <p>When you create an account, we collect:</p>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li>Name and email address</li>
            <li>Password (stored securely hashed, never in plain text)</li>
            <li>OAuth profile data if you sign in via Google (name, email, avatar)</li>
          </ul>

          <h3 className="text-lg font-semibold text-slate-900 mt-6 mb-3">Profile Information</h3>
          <p>You choose what to share publicly on your profile:</p>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li>Bio, skills, equipment, and languages</li>
            <li>Location (city or neighborhood — we geocode this to coordinates for radius search, but never expose precise coordinates publicly)</li>
            <li>Contact information (email, Telegram, WhatsApp, Signal)</li>
            <li>Social media links (LinkedIn, Twitter/X, GitHub, Instagram, YouTube, website)</li>
            <li>Crypto wallet addresses for payment (Ethereum, Base, Polygon, Arbitrum)</li>
            <li>Services and pricing information</li>
          </ul>

          <h3 className="text-lg font-semibold text-slate-900 mt-6 mb-3">Usage Data</h3>
          <p>We automatically collect:</p>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li>IP address (used for rate limiting and abuse prevention)</li>
            <li>Browser type and language preference</li>
            <li>Pages visited and feature usage (via PostHog analytics — see Section 6)</li>
          </ul>

          {/* Section 2: Legal Basis for Processing */}
          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">2. Legal Basis for Processing</h2>
          <p>
            Under the General Data Protection Regulation (GDPR), we process your personal data on
            the following legal bases:
          </p>

          <table className="w-full text-sm border-collapse border border-slate-300 mt-4">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-3 py-2 text-left font-semibold text-slate-900">Processing Activity</th>
                <th className="border border-slate-300 px-3 py-2 text-left font-semibold text-slate-900">Legal Basis</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              <tr>
                <td className="border border-slate-300 px-3 py-2">Account creation and authentication</td>
                <td className="border border-slate-300 px-3 py-2">Consent (Art. 6(1)(a)) — explicit checkbox at signup</td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-3 py-2">Profile data for discovery by AI agents</td>
                <td className="border border-slate-300 px-3 py-2">Contract (Art. 6(1)(b)) — core service functionality per Terms of Use</td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-3 py-2">Job offer delivery (email, Telegram)</td>
                <td className="border border-slate-300 px-3 py-2">Consent (Art. 6(1)(a)) — user controls notification toggles</td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-3 py-2">IP address for rate limiting and security</td>
                <td className="border border-slate-300 px-3 py-2">Legitimate interest (Art. 6(1)(f)) — abuse prevention and platform security</td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-3 py-2">Analytics (PostHog)</td>
                <td className="border border-slate-300 px-3 py-2">Legitimate interest (Art. 6(1)(f)) — product improvement. You can opt out from your dashboard at any time.</td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-3 py-2">Humanity verification (Gitcoin Passport)</td>
                <td className="border border-slate-300 px-3 py-2">Consent (Art. 6(1)(a)) — user-initiated action</td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-3 py-2">Password reset emails</td>
                <td className="border border-slate-300 px-3 py-2">Legitimate interest (Art. 6(1)(f)) — account recovery</td>
              </tr>
            </tbody>
          </table>

          {/* Section 3: How We Use Your Information */}
          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">3. How We Use Your Information</h2>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li><strong>Discovery:</strong> Your profile is searchable by AI agents and developers via our API so they can find people with the right skills and location for tasks.</li>
            <li><strong>Job Offers:</strong> AI agents can send you job offers through our platform. We deliver these to your email and/or Telegram.</li>
            <li><strong>Notifications:</strong> We send email notifications for job offers and account-related events.</li>
            <li><strong>Security:</strong> IP addresses are used for rate limiting, abuse prevention, and protecting your account.</li>
            <li><strong>Improvements:</strong> We use PostHog analytics (see Section 6) to understand how features are used and improve the platform. You can opt out of analytics tracking from your dashboard.</li>
          </ul>

          {/* Section 4: What We Do NOT Do */}
          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">4. What We Do NOT Do</h2>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li>We <strong>never sell</strong> your personal information to third parties.</li>
            <li>We <strong>never touch your funds</strong>. Payments go directly from the hiring agent to your wallet.</li>
            <li>We <strong>never take a commission</strong> on any transaction.</li>
            <li>We do <strong>not</strong> use tracking cookies or third-party advertising cookies.</li>
          </ul>

          {/* Section 5: Data Storage & Security */}
          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">5. Data Storage & Security</h2>
          <p>
            Your data is stored securely using encrypted connections. Passwords are hashed using bcrypt.
            Authentication tokens (JWT) are stored in your browser's local storage and expire automatically.
            We use HTTPS for all data transmission.
          </p>

          {/* Section 6: Cookies, Local Storage & Analytics */}
          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">6. Cookies, Local Storage & Analytics</h2>

          <h3 className="text-lg font-semibold text-slate-900 mt-6 mb-3">Browser Storage</h3>
          <p>We use minimal browser storage and no tracking cookies:</p>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li><strong>Authentication token:</strong> Keeps you logged in (local storage, expires in 7 days)</li>
            <li><strong>Language preference:</strong> Remembers your chosen language (local storage)</li>
          </ul>
          <p>We do not use tracking cookies or third-party advertising cookies.</p>

          <h3 className="text-lg font-semibold text-slate-900 mt-6 mb-3">PostHog Analytics</h3>
          <p>
            We use <strong>PostHog</strong> to understand how people use the platform and to improve
            our product. PostHog collects:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li>Page views and feature usage events (e.g., signup, onboarding steps)</li>
            <li>Your user ID (to associate events with your account)</li>
            <li>IP address (server-side, for aggregate geographic analysis)</li>
          </ul>
          <p>
            PostHog is configured with <strong>memory-only storage</strong> (no persistent cookies)
            and <strong>auto-capture disabled</strong> (only explicit events are tracked).
          </p>
          <p>
            <strong>You can opt out of analytics tracking at any time</strong> from your dashboard
            under Account Management. When opted out, we will not associate any analytics data with
            your account.
          </p>

          {/* Section 7: Third-Party Services */}
          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">7. Third-Party Services</h2>
          <p>We integrate with the following third-party services and maintain Data Processing Agreements (DPAs) where required:</p>
          <ul className="list-disc pl-6 space-y-2 text-slate-700">
            <li>
              <strong>PostHog (Analytics):</strong> Processes usage events and page views to help us
              improve the platform. PostHog stores data on US-based servers. You can opt out of
              analytics from your dashboard. PostHog's privacy policy is available at{' '}
              <a href="https://posthog.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">
                posthog.com/privacy
              </a>.
            </li>
            <li>
              <strong>Google OAuth:</strong> If you choose to sign in with Google, Google shares your
              basic profile information (name, email, avatar) with us according to their own privacy
              policy. We do not share your data back with them. We only request the minimum scopes
              needed: openid, email, and profile.
            </li>
            <li>
              <strong>Telegram Bot API:</strong> If you connect your Telegram account for notifications,
              we use the Telegram Bot API to send you job offer alerts. We store your Telegram chat ID
              to deliver messages. You can disconnect at any time from your dashboard.
            </li>
            <li>
              <strong>Email Provider (SMTP):</strong> We use an SMTP email service to send transactional
              emails (job offers, password resets, email verification). Your email address is shared
              with our email provider solely for delivery purposes.
            </li>
            <li>
              <strong>Gitcoin Passport:</strong> If you choose to verify your humanity, your wallet
              address is sent to Gitcoin Passport to obtain a verification score. This is user-initiated
              and only happens when you explicitly request verification.
            </li>
          </ul>

          {/* Section 8: Wallet Addresses */}
          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">8. Wallet Addresses</h2>
          <p>
            Crypto wallet addresses you add are publicly visible on your profile so that AI agents
            can send payments directly to you. Blockchain transactions are public by nature. We do
            not monitor or have access to your wallet balances or transaction history.
          </p>

          {/* Section 9: Data Retention */}
          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">9. Data Retention</h2>
          <p>We retain your data for the following periods:</p>
          <table className="w-full text-sm border-collapse border border-slate-300 mt-4">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-3 py-2 text-left font-semibold text-slate-900">Data Type</th>
                <th className="border border-slate-300 px-3 py-2 text-left font-semibold text-slate-900">Retention Period</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              <tr>
                <td className="border border-slate-300 px-3 py-2">Account and profile data</td>
                <td className="border border-slate-300 px-3 py-2">Until you delete your account</td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-3 py-2">Job history and reviews</td>
                <td className="border border-slate-300 px-3 py-2">Until you delete your account (cascading deletion)</td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-3 py-2">Password reset tokens</td>
                <td className="border border-slate-300 px-3 py-2">1 hour (automatically expired)</td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-3 py-2">OAuth state tokens</td>
                <td className="border border-slate-300 px-3 py-2">10 minutes (automatically expired)</td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-3 py-2">Server logs</td>
                <td className="border border-slate-300 px-3 py-2">90 days</td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-3 py-2">PostHog analytics events</td>
                <td className="border border-slate-300 px-3 py-2">Subject to PostHog's retention settings (currently 12 months)</td>
              </tr>
              <tr>
                <td className="border border-slate-300 px-3 py-2">Database backups</td>
                <td className="border border-slate-300 px-3 py-2">30 days</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2">
            When you delete your account, all associated data (profile, wallets, services, jobs,
            reviews, messages) is permanently and immediately deleted from our active database.
          </p>

          {/* Section 10: Your Rights & Choices */}
          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">10. Your Rights & Choices</h2>
          <p>Under GDPR and applicable data protection laws, you have the following rights:</p>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li><strong>Right of Access (Art. 15):</strong> You can download a copy of all your data in JSON format from your dashboard under Account Management.</li>
            <li><strong>Right to Rectification (Art. 16):</strong> You can update or correct any profile information from your dashboard.</li>
            <li><strong>Right to Erasure (Art. 17):</strong> You can delete your account and all associated data directly from your dashboard. Deletion is immediate and permanent.</li>
            <li><strong>Right to Restrict Processing (Art. 18):</strong> You can set your profile to unavailable to hide from search results, toggle individual notification channels on or off, and opt out of analytics.</li>
            <li><strong>Right to Data Portability (Art. 20):</strong> You can export all your data in a structured, machine-readable JSON format from your dashboard.</li>
            <li><strong>Right to Object (Art. 21):</strong> You can object to analytics processing by opting out from your dashboard. You can unsubscribe from email notifications via the toggle in your dashboard or the unsubscribe link in any notification email.</li>
          </ul>

          {/* Section 11: Breach Notification */}
          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">11. Data Breach Notification</h2>
          <p>
            In the event of a personal data breach that is likely to result in a risk to your rights
            and freedoms, we will:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li>Notify the relevant supervisory authority within 72 hours of becoming aware of the breach, as required by GDPR Article 33.</li>
            <li>Notify affected users without undue delay if the breach is likely to result in a high risk to their rights and freedoms, as required by GDPR Article 34.</li>
            <li>Document all breaches, including the facts, effects, and remedial actions taken.</li>
          </ul>

          {/* Section 12: Children's Privacy */}
          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">12. Children's Privacy</h2>
          <p>
            Human Pages is not intended for anyone under the age of 18. We do not knowingly collect
            information from minors.
          </p>

          {/* Section 13: Changes to This Policy */}
          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">13. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Changes will be posted on this page
            with an updated date. Continued use of the platform after changes constitutes acceptance
            of the updated policy.
          </p>

          {/* Section 14: Supervisory Authority */}
          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">14. Right to Complain</h2>
          <p>
            If you believe that our processing of your personal data infringes data protection laws,
            you have the right to lodge a complaint with your local data protection supervisory
            authority. A list of EU/EEA data protection authorities can be found at{' '}
            <a
              href="https://edpb.europa.eu/about-edpb/about-edpb/members_en"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700"
            >
              edpb.europa.eu
            </a>.
          </p>

          {/* Section 15: Contact */}
          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">15. Contact</h2>
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
      <Footer />
    </div>
  );
}
