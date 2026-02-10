import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import './index.css';
import { resolveInitialLanguage } from './i18n/ipLanguageDetector';
import { initI18n } from './i18n';
import { initPostHog } from './lib/posthog';

// Resolve geo language → init i18n → render.
// resolveInitialLanguage checks: user choice (instant) → cached IP (instant) → fetch (≤1.5s timeout).
// On repeat visits this adds zero delay (cache hit). On first visit, ≤1.5s max.
async function bootstrap() {
  const geoLang = await resolveInitialLanguage();
  initI18n(geoLang);

  // Initialize PostHog before app renders
  initPostHog();

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <HelmetProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </HelmetProvider>
    </React.StrictMode>
  );
}

bootstrap();
