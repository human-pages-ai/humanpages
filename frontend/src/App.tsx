import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { FeedbackProvider, useFeedback } from './hooks/useFeedback';
import { AdminRoleContext } from './hooks/useAdminRole';
import ErrorBoundary from './components/ErrorBoundary';
import LangWrapper from './components/LangWrapper';
import { posthog } from './lib/posthog';
import { api } from './lib/api';
import { safeSessionStorage } from './lib/safeStorage';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const DevelopersPage = lazy(() => import('./pages/DevelopersPage'));
const ConnectOverview = lazy(() => import('./pages/connect/ConnectOverview'));
const ConnectClaude = lazy(() => import('./pages/connect/ClaudePage'));
const ConnectCursor = lazy(() => import('./pages/connect/CursorPage'));
const ConnectWindsurf = lazy(() => import('./pages/connect/WindsurfPage'));
const ConnectChatGpt = lazy(() => import('./pages/connect/ChatGptPage'));
const ConnectOpenAiAgents = lazy(() => import('./pages/connect/OpenAiAgentsPage'));
const ConnectOpenAiResponses = lazy(() => import('./pages/connect/OpenAiResponsesPage'));
const ConnectGemini = lazy(() => import('./pages/connect/GeminiPage'));
const ConnectAndroidStudio = lazy(() => import('./pages/connect/AndroidStudioPage'));
const ConnectLangChain = lazy(() => import('./pages/connect/LangChainPage'));
const ConnectClawHub = lazy(() => import('./pages/connect/ClawHubPage'));
const ConnectOpenClaw = lazy(() => import('./pages/connect/OpenClawPage'));
const ConnectNanoClaw = lazy(() => import('./pages/connect/NanoClawPage'));
const ConnectZeroClaw = lazy(() => import('./pages/connect/ZeroClawPage'));
const ConnectNanobot = lazy(() => import('./pages/connect/NanobotPage'));
const ConnectTrustClaw = lazy(() => import('./pages/connect/TrustClawPage'));
const ConnectPicoClaw = lazy(() => import('./pages/connect/PicoClawPage'));
const ConnectMaxClaw = lazy(() => import('./pages/connect/MaxClawPage'));
const ConnectSmithery = lazy(() => import('./pages/connect/SmitheryPage'));
const FundingPage = lazy(() => import('./pages/FundingPage'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Onboarding = lazy(() => import('./pages/onboarding'));
const Welcome = lazy(() => import('./pages/Welcome'));
const OAuthCallback = lazy(() => import('./pages/OAuthCallback'));
const LinkedInVerifyCallback = lazy(() => import('./pages/LinkedInVerifyCallback'));
const GitHubVerifyCallback = lazy(() => import('./pages/GitHubVerifyCallback'));
const PublicProfile = lazy(() => import('./pages/PublicProfile'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfUse = lazy(() => import('./pages/TermsOfUse'));
const Badge = lazy(() => import('./pages/Badge'));
const JobDetail = lazy(() => import('./pages/JobDetail'));
const ReportAgent = lazy(() => import('./pages/ReportAgent'));
const JobBoard = lazy(() => import('./pages/JobBoard'));
const ListingDetail = lazy(() => import('./pages/ListingDetail'));
const BrandKit = lazy(() => import('./pages/BrandKit'));
const CareersPage = lazy(() => import('./pages/CareersPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const EmailVerified = lazy(() => import('./pages/EmailVerified'));
const StatusPage = lazy(() => import('./pages/StatusPage'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const GptSetupPage = lazy(() => import('./pages/GptSetupPage'));
const PartnersPage = lazy(() => import('./pages/PartnersPage'));
const PromptToCompletionPage = lazy(() => import('./pages/PromptToCompletionPage'));
const AgentProfile = lazy(() => import('./pages/AgentProfile'));
const SolverPage = lazy(() => import('./pages/SolverPage'));
const NotFound = lazy(() => import('./pages/NotFound'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminPeople = lazy(() => import('./pages/admin/AdminPeople'));
const AdminAgents = lazy(() => import('./pages/admin/AdminAgents'));
const AdminJobs = lazy(() => import('./pages/admin/AdminJobs'));
const AdminActivity = lazy(() => import('./pages/admin/AdminActivity'));
const AdminFeedback = lazy(() => import('./pages/admin/AdminFeedback'));
const AdminUserDetailPage = lazy(() => import('./pages/admin/AdminUserDetail'));
const AdminAgentDetailPage = lazy(() => import('./pages/admin/AdminAgentDetail'));
const AdminJobDetailPage = lazy(() => import('./pages/admin/AdminJobDetail'));
const AdminListings = lazy(() => import('./pages/admin/AdminListings'));
const AdminListingDetailPage = lazy(() => import('./pages/admin/AdminListingDetail'));
const PostingQueue = lazy(() => import('./pages/admin/PostingQueue'));
const PostingWorkMode = lazy(() => import('./pages/admin/PostingWorkMode'));
const ContentManager = lazy(() => import('./pages/admin/ContentManager'));
const DynamicBlogPost = lazy(() => import('./pages/blog/DynamicBlogPost'));
const AdminAdCopy = lazy(() => import('./pages/admin/AdminAdCopy'));
const AdminVideoConcepts = lazy(() => import('./pages/admin/AdminVideoConcepts'));
const AdminPhotoConcepts = lazy(() => import('./pages/admin/AdminPhotoConcepts'));
const AdminCareerApplications = lazy(() => import('./pages/admin/AdminCareerApplications'));
const AdminSchedule = lazy(() => import('./pages/admin/AdminSchedule'));
const AdminLeadGeneration = lazy(() => import('./pages/admin/AdminLeadGeneration'));
const AdminLogs = lazy(() => import('./pages/admin/AdminLogs'));
const AdminEmails = lazy(() => import('./pages/admin/AdminEmails'));
const AdminLinkCodes = lazy(() => import('./pages/admin/AdminLinkCodes'));
const AdminModeration = lazy(() => import('./pages/admin/AdminModeration'));
const AdminWatchDog = lazy(() => import('./pages/admin/AdminWatchDog'));
const AdminSolver = lazy(() => import('./pages/admin/AdminSolver'));
const AdminMarketingOps = lazy(() => import('./pages/admin/MarketingOps'));
const StaffManagement = lazy(() => import('./pages/admin/StaffManagement'));
const StaffProductivity = lazy(() => import('./pages/admin/StaffProductivity'));
const StaffDashboard = lazy(() => import('./pages/admin/StaffDashboard'));
const TaskCentral = lazy(() => import('./pages/admin/TaskCentral'));
const BlogIndex = lazy(() => import('./pages/blog/BlogIndex'));
const AiAgentsHiringHumans = lazy(() => import('./pages/blog/articles/AiAgentsHiringHumans'));
const GettingPaidUsdc = lazy(() => import('./pages/blog/articles/GettingPaidUsdc'));
const McpProtocol = lazy(() => import('./pages/blog/articles/McpProtocol'));
const FreeMoltbookAgent = lazy(() => import('./pages/blog/articles/FreeMoltbookAgent'));
const ZeroDollarAgent = lazy(() => import('./pages/blog/articles/ZeroDollarAgent'));
const TrustModelsHumanAgent = lazy(() => import('./pages/blog/articles/TrustModelsHumanAgent'));
const SocialMediaMarketingHiring = lazy(() => import('./pages/blog/articles/SocialMediaMarketingHiring'));
const AutomatedInfluencerOutreach = lazy(() => import('./pages/blog/articles/AutomatedInfluencerOutreach'));
const GetPaidSocialMediaPromotion = lazy(() => import('./pages/blog/articles/GetPaidSocialMediaPromotion'));
const SetUpProfileFiveMinutes = lazy(() => import('./pages/blog/articles/SetUpProfileFiveMinutes'));
const MoltbookSurvivalGuide = lazy(() => import('./pages/blog/articles/MoltbookSurvivalGuide'));
const RentahumanAlternative = lazy(() => import('./pages/blog/articles/RentahumanAlternative'));
const FeedbackWidget = lazy(() => import('./components/FeedbackWidget'));

function LoadingSpinner() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen flex items-center justify-center" role="status" aria-label="Loading">
      {t('common.loading')}
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return user ? <Navigate to="/dashboard" replace /> : <>{children}</>;
}

function HomeRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return user ? <Navigate to="/dashboard" replace /> : <LandingPage />;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [roleState, setRoleState] = useState<{ isAdmin: boolean; isStaff: boolean; capabilities: import('./types/admin').StaffCapability[] } | null>(null);

  useEffect(() => {
    if (!loading && user) {
      api.checkAdmin()
        .then((res) => setRoleState({ isAdmin: res.isAdmin, isStaff: res.isStaff, capabilities: res.capabilities }))
        .catch(() => setRoleState({ isAdmin: false, isStaff: false, capabilities: [] }));
    }
  }, [user, loading]);

  if (loading || (user && roleState === null)) {
    return <LoadingSpinner />;
  }

  if (!user || (!roleState?.isAdmin && !roleState?.isStaff)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <AdminRoleContext.Provider value={roleState}>
      {children}
    </AdminRoleContext.Provider>
  );
}

function AdminIndex() {
  // Lazy import — we check role to decide what to render
  const [roleState, setRoleState] = useState<{ isAdmin: boolean } | null>(null);

  useEffect(() => {
    api.checkAdmin()
      .then((res) => setRoleState({ isAdmin: res.isAdmin }))
      .catch(() => setRoleState({ isAdmin: false }));
  }, []);

  if (roleState === null) return <LoadingSpinner />;
  if (!roleState.isAdmin) return <Navigate to="/admin/tasks" replace />;
  return <AdminOverview />;
}

function usePageView() {
  const location = useLocation();
  useEffect(() => {
    posthog.capture('$pageview', {
      $current_url: window.location.href,
      path: location.pathname,
    });
    // Persist UTM params from any landing URL into sessionStorage
    const params = new URLSearchParams(window.location.search);
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      const val = params.get(key);
      if (val) safeSessionStorage.setItem(key, val);
    }
  }, [location.pathname]);
}

function AppRoutes() {
  usePageView();

  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/dev" element={<DevelopersPage />} />
      <Route path="/solver" element={<SolverPage />} />
      <Route path="/dev/connect" element={<ConnectOverview />} />
      <Route path="/dev/connect/claude" element={<ConnectClaude />} />
      <Route path="/dev/connect/cursor" element={<ConnectCursor />} />
      <Route path="/dev/connect/windsurf" element={<ConnectWindsurf />} />
      <Route path="/dev/connect/chatgpt" element={<ConnectChatGpt />} />
      <Route path="/dev/connect/openai-agents" element={<ConnectOpenAiAgents />} />
      <Route path="/dev/connect/openai-responses" element={<ConnectOpenAiResponses />} />
      <Route path="/dev/connect/gemini" element={<ConnectGemini />} />
      <Route path="/dev/connect/android-studio" element={<ConnectAndroidStudio />} />
      <Route path="/dev/connect/langchain" element={<ConnectLangChain />} />
      <Route path="/dev/connect/clawhub" element={<ConnectClawHub />} />
      <Route path="/dev/connect/openclaw" element={<ConnectOpenClaw />} />
      <Route path="/dev/connect/nanoclaw" element={<ConnectNanoClaw />} />
      <Route path="/dev/connect/zeroclaw" element={<ConnectZeroClaw />} />
      <Route path="/dev/connect/nanobot" element={<ConnectNanobot />} />
      <Route path="/dev/connect/trustclaw" element={<ConnectTrustClaw />} />
      <Route path="/dev/connect/picoclaw" element={<ConnectPicoClaw />} />
      <Route path="/dev/connect/maxclaw" element={<ConnectMaxClaw />} />
      <Route path="/dev/connect/smithery" element={<ConnectSmithery />} />
      <Route path="/funding" element={<FundingPage />} />
      <Route path="/gpt-setup" element={<GptSetupPage />} />
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicRoute>
            <Signup />
          </PublicRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/jobs/:id"
        element={
          <ProtectedRoute>
            <JobDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <Onboarding />
          </ProtectedRoute>
        }
      />
      <Route
        path="/welcome"
        element={
          <ProtectedRoute>
            <Welcome />
          </ProtectedRoute>
        }
      />
      <Route path="/auth/:provider/callback" element={<OAuthCallback />} />
      <Route
        path="/auth/linkedin-verify/callback"
        element={
          <ProtectedRoute>
            <LinkedInVerifyCallback />
          </ProtectedRoute>
        }
      />
      <Route
        path="/auth/github-verify/callback"
        element={
          <ProtectedRoute>
            <GitHubVerifyCallback />
          </ProtectedRoute>
        }
      />
      <Route path="/agents/:id" element={<AgentProfile />} />
      <Route path="/humans/:id" element={<PublicProfile />} />
      <Route path="/u/:username" element={<PublicProfile />} />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPassword />
          </PublicRoute>
        }
      />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/email-verified" element={<EmailVerified />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfUse />} />
      <Route path="/badge" element={<Badge />} />
      <Route path="/report" element={<ReportAgent />} />
      <Route path="/brand" element={<BrandKit />} />
      <Route path="/status" element={<StatusPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/prompt-to-completion" element={<PromptToCompletionPage />} />
      <Route path="/partners" element={<PartnersPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/careers" element={<CareersPage />} />
      <Route path="/careers/apply/:positionId" element={<CareersPage />} />
      <Route path="/listings" element={<JobBoard />} />
      <Route path="/listings/:id" element={<ListingDetail />} />
      <Route path="/work/:code" element={<ListingDetail />} />
      <Route path="/:lang/work/:code" element={<LangWrapper><ListingDetail /></LangWrapper>} />
      <Route path="/blog" element={<BlogIndex />} />
      <Route path="/blog/ai-agents-hiring-humans" element={<AiAgentsHiringHumans />} />
      <Route path="/blog/getting-paid-usdc-freelancers" element={<GettingPaidUsdc />} />
      <Route path="/blog/mcp-protocol-ai-agents" element={<McpProtocol />} />
      <Route path="/blog/free-moltbook-agent" element={<FreeMoltbookAgent />} />
      <Route path="/blog/zero-dollar-ai-agent" element={<ZeroDollarAgent />} />
      <Route path="/blog/trust-models-human-agent" element={<TrustModelsHumanAgent />} />
      <Route path="/blog/social-media-marketing-hiring-process" element={<SocialMediaMarketingHiring />} />
      <Route path="/blog/automated-influencer-outreach" element={<AutomatedInfluencerOutreach />} />
      <Route path="/blog/get-paid-social-media-promotion" element={<GetPaidSocialMediaPromotion />} />
      <Route path="/blog/build-ai-agent-that-hires-people" element={<SetUpProfileFiveMinutes />} />
      <Route path="/blog/moltbook-agent-survival-guide" element={<MoltbookSurvivalGuide />} />
      <Route path="/blog/rentahuman-alternative" element={<RentahumanAlternative />} />
      <Route path="/blog/:slug" element={<DynamicBlogPost />} />

      {/* Language-prefixed routes for SEO */}
      <Route path="/:lang" element={<LangWrapper><PublicRoute><LandingPage /></PublicRoute></LangWrapper>} />
      {/* /dev/* and /dev/connect/* are English-only — no /:lang prefix */}
      <Route path="/:lang/humans/:id" element={<LangWrapper><PublicProfile /></LangWrapper>} />
      <Route path="/:lang/u/:username" element={<LangWrapper><PublicProfile /></LangWrapper>} />
      <Route path="/:lang/signup" element={<LangWrapper><PublicRoute><Signup /></PublicRoute></LangWrapper>} />
      <Route path="/:lang/listings" element={<LangWrapper><JobBoard /></LangWrapper>} />
      <Route path="/:lang/listings/:id" element={<LangWrapper><ListingDetail /></LangWrapper>} />
      <Route path="/:lang/blog" element={<LangWrapper><BlogIndex /></LangWrapper>} />
      <Route path="/:lang/blog/ai-agents-hiring-humans" element={<LangWrapper><AiAgentsHiringHumans /></LangWrapper>} />
      <Route path="/:lang/blog/getting-paid-usdc-freelancers" element={<LangWrapper><GettingPaidUsdc /></LangWrapper>} />
      <Route path="/:lang/blog/mcp-protocol-ai-agents" element={<LangWrapper><McpProtocol /></LangWrapper>} />
      <Route path="/:lang/blog/free-moltbook-agent" element={<LangWrapper><FreeMoltbookAgent /></LangWrapper>} />
      <Route path="/:lang/blog/zero-dollar-ai-agent" element={<LangWrapper><ZeroDollarAgent /></LangWrapper>} />
      <Route path="/:lang/blog/trust-models-human-agent" element={<LangWrapper><TrustModelsHumanAgent /></LangWrapper>} />
      <Route path="/:lang/blog/social-media-marketing-hiring-process" element={<LangWrapper><SocialMediaMarketingHiring /></LangWrapper>} />
      <Route path="/:lang/blog/automated-influencer-outreach" element={<LangWrapper><AutomatedInfluencerOutreach /></LangWrapper>} />
      <Route path="/:lang/blog/get-paid-social-media-promotion" element={<LangWrapper><GetPaidSocialMediaPromotion /></LangWrapper>} />
      <Route path="/:lang/blog/build-ai-agent-that-hires-people" element={<LangWrapper><SetUpProfileFiveMinutes /></LangWrapper>} />
      <Route path="/:lang/blog/moltbook-agent-survival-guide" element={<LangWrapper><MoltbookSurvivalGuide /></LangWrapper>} />
      <Route path="/:lang/blog/rentahuman-alternative" element={<LangWrapper><RentahumanAlternative /></LangWrapper>} />
      <Route path="/:lang/blog/:slug" element={<LangWrapper><DynamicBlogPost /></LangWrapper>} />
      <Route path="/:lang/status" element={<LangWrapper><StatusPage /></LangWrapper>} />
      <Route path="/:lang/pricing" element={<LangWrapper><PricingPage /></LangWrapper>} />
      {/* /prompt-to-completion is English-only — no /:lang prefix */}
      <Route path="/:lang/partners" element={<LangWrapper><PartnersPage /></LangWrapper>} />
      <Route path="/:lang/about" element={<LangWrapper><AboutPage /></LangWrapper>} />
      <Route path="/:lang/careers" element={<LangWrapper><CareersPage /></LangWrapper>} />
      <Route path="/:lang/careers/apply/:positionId" element={<LangWrapper><CareersPage /></LangWrapper>} />
      <Route path="/:lang/privacy" element={<LangWrapper><PrivacyPolicy /></LangWrapper>} />
      <Route path="/:lang/terms" element={<LangWrapper><TermsOfUse /></LangWrapper>} />

      <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route index element={<AdminIndex />} />
        <Route path="people" element={<AdminPeople />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="users/:id" element={<AdminUserDetailPage />} />
        <Route path="agents" element={<AdminAgents />} />
        <Route path="agents/:id" element={<AdminAgentDetailPage />} />
        <Route path="jobs" element={<AdminJobs />} />
        <Route path="jobs/:id" element={<AdminJobDetailPage />} />
        <Route path="listings" element={<AdminListings />} />
        <Route path="listings/:id" element={<AdminListingDetailPage />} />
        <Route path="activity" element={<AdminActivity />} />
        <Route path="feedback" element={<AdminFeedback />} />
        <Route path="tasks" element={<TaskCentral />} />
        <Route path="time-tracking" element={<StaffDashboard />} />
        <Route path="content" element={<ContentManager />} />
        <Route path="posting" element={<PostingQueue />} />
        <Route path="posting/work" element={<PostingWorkMode />} />
        <Route path="ad-copy" element={<AdminAdCopy />} />
        <Route path="video" element={<AdminVideoConcepts />} />
        <Route path="photos" element={<AdminPhotoConcepts />} />
        <Route path="careers" element={<AdminCareerApplications />} />
        <Route path="schedule" element={<AdminSchedule />} />
        <Route path="staff" element={<StaffManagement />} />
        <Route path="productivity" element={<StaffProductivity />} />
        <Route path="leads" element={<AdminLeadGeneration />} />
        <Route path="logs" element={<AdminLogs />} />
        <Route path="emails" element={<AdminEmails />} />
        <Route path="link-codes" element={<AdminLinkCodes />} />
        <Route path="moderation" element={<AdminModeration />} />
        <Route path="watchdog" element={<AdminWatchDog />} />
        <Route path="marketing-ops" element={<AdminMarketingOps />} />
        <Route path="solver" element={<AdminSolver />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function ConnectedFeedbackWidget() {
  const location = useLocation();
  const { isOpen, defaultType, openFeedback, closeFeedback } = useFeedback();

  // Hide the floating feedback button during onboarding to avoid overlapping the Next/Submit buttons
  if (location.pathname === '/onboarding') return null;

  return (
    <FeedbackWidget
      defaultType={defaultType}
      isOpen={isOpen}
      onOpenChange={(open) => { if (open) openFeedback(); else closeFeedback(); }}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <FeedbackProvider>
        <ErrorBoundary>
          <Suspense fallback={<LoadingSpinner />}>
            <AppRoutes />
          </Suspense>
        </ErrorBoundary>
        <Suspense fallback={null}>
          <ConnectedFeedbackWidget />
        </Suspense>
        <Toaster position="top-right" />
      </FeedbackProvider>
    </AuthProvider>
  );
}
