import { useTranslation } from 'react-i18next';
import Link from '../components/LocalizedLink';
import Logo from '../components/Logo';
import SEO from '../components/SEO';
import Footer from '../components/Footer';

export default function TermsOfUse() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-slate-50">
      <SEO
        title="Terms of Use"
        description="Read the terms and conditions for using Human Pages, the listing service that connects AI agents with real humans."
        path="/terms"
      />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link to="/"><Logo /></Link>
          <Link
            to="/signup"
            className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 transition-colors"
          >
            {t('nav.startProfile')}
          </Link>
        </div>
      </header>

      <main className="py-12 md:py-16 px-4">
        <article className="max-w-3xl mx-auto prose prose-slate">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Terms of Use</h1>
          <p className="text-slate-500 mb-8">Last updated: March 31, 2026</p>

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
          <p>
            We may feature selected profiles (including your name, photo, skills, and location) on
            our homepage and marketing materials to showcase the community. You can opt in or out of
            featured placement at any time from your dashboard settings.
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

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">6. Escrow & Smart Contracts</h2>
          <p>
            Human Pages offers an optional escrow system powered by smart contracts on the Base
            network. When using escrow:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li>Funds are held in a non-custodial smart contract — Human Pages <strong>never has custody or control</strong> over escrowed funds.</li>
            <li>Smart contracts are immutable once deployed. We cannot reverse, modify, or override on-chain transactions.</li>
            <li>You acknowledge the inherent risks of interacting with blockchain smart contracts, including but not limited to bugs, exploits, network congestion, and gas costs.</li>
            <li>Escrow deposits are in USDC on Base. You are responsible for ensuring you interact with the correct contract addresses.</li>
            <li>If no dispute is raised within the dispute window, escrowed funds are automatically released to the payee.</li>
          </ul>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">7. Dispute Resolution & Arbitration</h2>
          <p>
            For escrow-backed jobs, either party may raise a dispute within the dispute window.
            Disputes are resolved by independent third-party arbitrators:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li>Arbitrators are independent agents, <strong>not employees or representatives</strong> of Human Pages.</li>
            <li>The arbitrator is selected by the depositor at the time of escrow creation. By using escrow, both parties agree to accept the selected arbitrator's verdict.</li>
            <li>Arbitrator verdicts are signed on-chain using EIP-712 and are <strong>final and binding</strong> within the platform. There is no appeals process.</li>
            <li>Human Pages does not review, endorse, or guarantee the fairness of any arbitrator's decision.</li>
            <li>If the arbitrator fails to respond within 7 days, escrowed funds are automatically released to the payee.</li>
          </ul>
          <p className="mt-2">
            <strong>For arbitrators:</strong> By registering as an arbitrator on Human Pages, you
            represent that you understand the role and its responsibilities. Dispute resolution
            may be subject to laws and regulations in your jurisdiction, including licensing or
            registration requirements. It is solely your responsibility to determine and comply
            with any applicable local laws before acting as an arbitrator.
          </p>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">8. Job Offers</h2>
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

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">9. API & Developer Access</h2>
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

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">10. Prohibited Conduct</h2>
          <p>You agree not to:</p>
          <ul className="list-disc pl-6 space-y-1 text-slate-700">
            <li>Provide false or misleading information on your profile.</li>
            <li><strong>Impersonate</strong> any person, business, or entity, or falsely claim an affiliation with any person or organization.</li>
            <li>Create accounts using fake identities, stolen credentials, or another person's information without their consent.</li>
            <li>Use the platform for any <strong>illegal, fraudulent, or deceptive</strong> activity, including but not limited to scams, phishing, money laundering, or identity theft.</li>
            <li>Send spam, fraudulent, or abusive job offers.</li>
            <li>Create multiple accounts to circumvent rate limits, bans, or other restrictions.</li>
            <li>Use automated tools, bots, or scripts to create accounts or interact with the platform without our prior written consent.</li>
            <li>Attempt to hack, disrupt, or exploit the service, including denial-of-service attacks or unauthorized access to other users' accounts.</li>
            <li>Scrape or harvest user data for unauthorized purposes.</li>
            <li>Misrepresent your skills, qualifications, location, or availability.</li>
          </ul>
          <p className="mt-2">
            Violation of these rules may result in immediate account termination, reporting to
            law enforcement, and any other remedies available under applicable law.
          </p>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">11. Limitation of Liability</h2>
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

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">12. Account Termination</h2>
          <p>
            We may suspend or terminate your account if you violate these terms or engage in
            prohibited conduct. You may delete your account at any time by contacting us.
          </p>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">13. Intellectual Property</h2>
          <p>
            You retain ownership of all content you post on your profile. By creating a profile,
            you grant Human Pages a license to display and distribute your profile information
            through the website and API for the purpose of providing the service.
          </p>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">14. Compliance with Laws</h2>
          <p>
            You are solely responsible for complying with all laws, regulations, and licensing
            requirements applicable to your use of Human Pages in your jurisdiction. This includes
            but is not limited to laws related to employment, freelance work, cryptocurrency,
            taxation, dispute resolution, and data protection. Human Pages makes no representation
            that the platform or its features are appropriate or available for use in any
            particular jurisdiction.
          </p>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">15. Indemnification</h2>
          <p>
            You agree to indemnify, defend, and hold harmless Human Pages, its operators, and
            affiliates from and against any claims, damages, losses, liabilities, costs, and
            expenses (including reasonable legal fees) arising out of or related to: (a) your
            use of the platform; (b) your violation of these Terms; (c) your interactions with
            other users, hiring parties, or arbitrators; or (d) any content you submit to the
            platform.
          </p>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">16. Changes to These Terms</h2>
          <p>
            We may update these Terms of Use from time to time. Changes will be posted on this
            page with an updated date. Continued use of the platform after changes constitutes
            acceptance of the updated terms.
          </p>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">17. Governing Law</h2>
          <p>
            These Terms of Use and any disputes arising from your use of Human Pages shall be
            governed by and construed in accordance with applicable law. You acknowledge that
            Human Pages operates as a global platform and that legal requirements may vary by
            jurisdiction. Any formal disputes that cannot be resolved informally shall be
            submitted to the competent courts of the jurisdiction in which Human Pages is
            incorporated.
          </p>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">18. Severability</h2>
          <p>
            If any provision of these Terms is found to be unenforceable or invalid by a court
            of competent jurisdiction, that provision shall be limited or eliminated to the
            minimum extent necessary, and the remaining provisions shall remain in full force
            and effect.
          </p>

          <h2 className="text-xl font-bold text-slate-900 mt-8 mb-4">19. Contact</h2>
          <p>
            If you have questions about these Terms of Use, reach out to us on our{' '}
            <a
              href="https://www.facebook.com/HumanPagesAI/"
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
