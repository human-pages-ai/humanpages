import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './hooks/useAuth';
import ErrorBoundary from './components/ErrorBoundary';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const DevelopersPage = lazy(() => import('./pages/DevelopersPage'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Welcome = lazy(() => import('./pages/Welcome'));
const OAuthCallback = lazy(() => import('./pages/OAuthCallback'));
const PublicProfile = lazy(() => import('./pages/PublicProfile'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfUse = lazy(() => import('./pages/TermsOfUse'));
const NotFound = lazy(() => import('./pages/NotFound'));

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

function AppRoutes() {
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
