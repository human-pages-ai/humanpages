import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './hooks/useAuth';
import ErrorBoundary from './components/ErrorBoundary';
import LangWrapper from './components/LangWrapper';
import { posthog } from './lib/posthog';

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
const BlogIndex = lazy(() => import('./pages/blog/BlogIndex'));
const AiAgentsHiringHumans = lazy(() => import('./pages/blog/articles/AiAgentsHiringHumans'));
const GettingPaidUsdc = lazy(() => import('./pages/blog/articles/GettingPaidUsdc'));
const McpProtocol = lazy(() => import('./pages/blog/articles/McpProtocol'));
const FreeMoltbookAgent = lazy(() => import('./pages/blog/articles/FreeMoltbookAgent'));

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

      {/* Language-prefixed routes for SEO */}
      <Route path="/:lang" element={<LangWrapper><PublicRoute><LandingPage /></PublicRoute></LangWrapper>} />
      <Route path="/:lang/dev" element={<LangWrapper><DevelopersPage /></LangWrapper>} />
      <Route path="/:lang/humans/:id" element={<LangWrapper><PublicProfile /></LangWrapper>} />
      <Route path="/:lang/signup" element={<LangWrapper><PublicRoute><Signup /></PublicRoute></LangWrapper>} />
      <Route path="/:lang/blog" element={<LangWrapper><BlogIndex /></LangWrapper>} />
      <Route path="/:lang/blog/ai-agents-hiring-humans" element={<LangWrapper><AiAgentsHiringHumans /></LangWrapper>} />
      <Route path="/:lang/blog/getting-paid-usdc-freelancers" element={<LangWrapper><GettingPaidUsdc /></LangWrapper>} />
      <Route path="/:lang/blog/mcp-protocol-ai-agents" element={<LangWrapper><McpProtocol /></LangWrapper>} />
      <Route path="/:lang/blog/free-moltbook-agent" element={<LangWrapper><FreeMoltbookAgent /></LangWrapper>} />
      <Route path="/:lang/privacy" element={<LangWrapper><PrivacyPolicy /></LangWrapper>} />
      <Route path="/:lang/terms" element={<LangWrapper><TermsOfUse /></LangWrapper>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <Suspense fallback={<LoadingSpinner />}>
          <AppRoutes />
        </Suspense>
      </ErrorBoundary>
      <Toaster position="top-right" />
    </AuthProvider>
  );
}
