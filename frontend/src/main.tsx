import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import './index.css';
import { resolveInitialLanguageSync, fetchGeoLanguage } from './i18n/ipLanguageDetector';
import { initI18n } from './i18n';
import i18n from './i18n';
import { initPostHog } from './lib/posthog';

// Phase 1: Synchronous — check localStorage for user choice or cached IP result (instant).
const syncLang = resolveInitialLanguageSync();

// Phase 2: If we have a cached/chosen language, init immediately with it.
//          If not (first visit), init with fallback and fetch geo in background.
initI18n(syncLang);

if (!syncLang) {
  // First visit — fetch geo language in background, apply when ready.
  // The page renders immediately with navigator/fallback language.
  // If geo resolves, i18n switches seamlessly (react-i18next re-renders).
  fetchGeoLanguage().then((geoLang) => {
    if (geoLang && geoLang !== i18n.language) {
      i18n.changeLanguage(geoLang);
    }
  });
}

// Initialize PostHog
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
