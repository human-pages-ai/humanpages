import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { FeedbackProvider, useFeedback } from './hooks/useFeedback';
import ErrorBoundary from './components/ErrorBoundary';
import LangWrapper from './components/LangWrapper';
import { posthog } from './lib/posthog';
import { api } from './lib/api';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const DevelopersPage = lazy(() => import('./pages/DevelopersPage'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Welcome = lazy(() => import('./pages/Welcome'));
const OAuthCallback = lazy(() => import('./pages/OAuthCallback'));
const LinkedInVerifyCallback = lazy(() => import('./pages/LinkedInVerifyCallback'));
const PublicProfile = lazy(() => import('./pages/PublicProfile'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfUse = lazy(() => import('./pages/TermsOfUse'));
const Badge = lazy(() => import('./pages/Badge'));
const JobDetail = lazy(() => import('./pages/JobDetail'));
const ReportAgent = lazy(() => import('./pages/ReportAgent'));
const NotFound = lazy(() => import('./pages/NotFound'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminAgents = lazy(() => import('./pages/admin/AdminAgents'));
const AdminJobs = lazy(() => import('./pages/admin/AdminJobs'));
const AdminActivity = lazy(() => import('./pages/admin/AdminActivity'));
const AdminFeedback = lazy(() => import('./pages/admin/AdminFeedback'));
const AdminUserDetailPage = lazy(() => import('./pages/admin/AdminUserDetail'));
const AdminAgentDetailPage = lazy(() => import('./pages/admin/AdminAgentDetail'));
const AdminJobDetailPage = lazy(() => import('./pages/admin/AdminJobDetail'));
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
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!loading && user) {
      api.checkAdmin()
        .then(() => setIsAdmin(true))
        .catch(() => setIsAdmin(false));
    }
  }, [user, loading]);

  if (loading || (user && isAdmin === null)) {
    return <LoadingSpinner />;
  }

  if (!user || isAdmin === false) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function usePageView() {
  const location = useLocation();
  useEffect(() => {
    posthog.capture('$pageview', {
      $current_url: window.location.href,
      path: location.pathname,
    });
  }, [location.pathname]);
}

function AppRoutes() {
  usePageView();

  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      <Route path="/dev" element={<DevelopersPage />} />
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
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfUse />} />
      <Route path="/badge" element={<Badge />} />
      <Route path="/report" element={<ReportAgent />} />
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

      {/* Language-prefixed routes for SEO */}
      <Route path="/:lang" element={<LangWrapper><PublicRoute><LandingPage /></PublicRoute></LangWrapper>} />
      <Route path="/:lang/dev" element={<LangWrapper><DevelopersPage /></LangWrapper>} />
      <Route path="/:lang/humans/:id" element={<LangWrapper><PublicProfile /></LangWrapper>} />
      <Route path="/:lang/u/:username" element={<LangWrapper><PublicProfile /></LangWrapper>} />
      <Route path="/:lang/signup" element={<LangWrapper><PublicRoute><Signup /></PublicRoute></LangWrapper>} />
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
      <Route path="/:lang/privacy" element={<LangWrapper><PrivacyPolicy /></LangWrapper>} />
      <Route path="/:lang/terms" element={<LangWrapper><TermsOfUse /></LangWrapper>} />

      <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route index element={<AdminOverview />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="users/:id" element={<AdminUserDetailPage />} />
        <Route path="agents" element={<AdminAgents />} />
        <Route path="agents/:id" element={<AdminAgentDetailPage />} />
        <Route path="jobs" element={<AdminJobs />} />
        <Route path="jobs/:id" element={<AdminJobDetailPage />} />
        <Route path="activity" element={<AdminActivity />} />
        <Route path="feedback" element={<AdminFeedback />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function ConnectedFeedbackWidget() {
  const { isOpen, defaultType, openFeedback, closeFeedback } = useFeedback();
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
