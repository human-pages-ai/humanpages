# Internationalization (i18n)

**Status:** Planned (Post-Launch)
**Priority:** Medium
**Complexity:** Medium

---

## Overview

Automatic translation of the entire platform based on user location, with easy language switching. Covers both frontend UI and backend API responses shown to users.

---

## Language Detection Priority

1. **User preference** (stored in localStorage/cookie)
2. **Browser language** (`navigator.language`)
3. **IP geolocation** (fallback for first visit)
4. **Default**: English

---

## Supported Languages (Phase 1)

| Code | Language | Coverage |
|------|----------|----------|
| `en` | English | 100% (default) |
| `es` | Spanish | Latin America, Spain |
| `zh` | Chinese (Simplified) | China |
| `pt` | Portuguese | Brazil |
| `fr` | French | France, Africa |
| `de` | German | Germany, Austria |
| `ja` | Japanese | Japan |
| `ko` | Korean | South Korea |

Expand based on user demographics post-launch.

---

## Frontend Implementation

### Tech Stack

```
react-i18next     - React integration
i18next           - Core i18n framework
i18next-browser-languagedetector  - Auto-detect language
i18next-http-backend              - Load translations dynamically
```

### File Structure

```
frontend/src/
├── i18n/
│   ├── index.ts              # i18n configuration
│   ├── locales/
│   │   ├── en/
│   │   │   ├── common.json   # Shared strings
│   │   │   ├── auth.json     # Login, signup, etc.
│   │   │   ├── dashboard.json
│   │   │   ├── jobs.json
│   │   │   └── profile.json
│   │   ├── es/
│   │   │   └── ... (same structure)
│   │   ├── zh/
│   │   └── ...
│   └── LanguageSwitcher.tsx  # Toggle component
```

### Translation File Example

**`en/common.json`**
```json
{
  "nav": {
    "home": "Home",
    "dashboard": "Dashboard",
    "login": "Log In",
    "signup": "Sign Up",
    "logout": "Log Out"
  },
  "actions": {
    "save": "Save",
    "cancel": "Cancel",
    "submit": "Submit",
    "delete": "Delete",
    "edit": "Edit"
  },
  "status": {
    "loading": "Loading...",
    "error": "Something went wrong",
    "success": "Success!"
  }
}
```

**`es/common.json`**
```json
{
  "nav": {
    "home": "Inicio",
    "dashboard": "Panel",
    "login": "Iniciar Sesión",
    "signup": "Registrarse",
    "logout": "Cerrar Sesión"
  },
  "actions": {
    "save": "Guardar",
    "cancel": "Cancelar",
    "submit": "Enviar",
    "delete": "Eliminar",
    "edit": "Editar"
  },
  "status": {
    "loading": "Cargando...",
    "error": "Algo salió mal",
    "success": "¡Éxito!"
  }
}
```

### i18n Configuration

```typescript
// frontend/src/i18n/index.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'es', 'zh', 'pt', 'fr', 'de', 'ja', 'ko'],

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },

    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },

    ns: ['common', 'auth', 'dashboard', 'jobs', 'profile'],
    defaultNS: 'common',

    interpolation: {
      escapeValue: false, // React already escapes
    },
  });

export default i18n;
```

### Usage in Components

```tsx
import { useTranslation } from 'react-i18next';

function Dashboard() {
  const { t } = useTranslation('dashboard');

  return (
    <div>
      <h1>{t('title')}</h1>
      <button>{t('common:actions.save')}</button>
    </div>
  );
}
```

### Language Switcher Component

```tsx
// frontend/src/i18n/LanguageSwitcher.tsx
import { useTranslation } from 'react-i18next';

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'pt', name: 'Português', flag: '🇧🇷' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <select
      value={i18n.language}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      className="language-switcher"
    >
      {languages.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.flag} {lang.name}
        </option>
      ))}
    </select>
  );
}
```

### Placement

- **Header/Navbar**: Small dropdown in top-right corner
- **Footer**: Text links to all languages
- **Settings page**: Full language selection with preview

---

## Backend Implementation

### Approach

1. Accept `Accept-Language` header from frontend
2. Store user's preferred language in database (optional)
3. Return translated strings in API responses
4. Translate: error messages, email content, notifications

### Translation Middleware

```typescript
// backend/src/middleware/i18n.ts
import { Request, Response, NextFunction } from 'express';

const translations: Record<string, Record<string, string>> = {
  en: {
    'job.not_found': 'Job not found',
    'job.already_accepted': 'Job has already been accepted',
    'payment.rejected': 'Payment rejected',
    'payment.insufficient': 'Payment amount is less than agreed price',
    'auth.invalid_credentials': 'Invalid email or password',
    'rate_limit.exceeded': 'Too many requests. Try again later.',
    // ... more
  },
  es: {
    'job.not_found': 'Trabajo no encontrado',
    'job.already_accepted': 'El trabajo ya ha sido aceptado',
    'payment.rejected': 'Pago rechazado',
    'payment.insufficient': 'El monto del pago es menor al precio acordado',
    'auth.invalid_credentials': 'Email o contraseña inválidos',
    'rate_limit.exceeded': 'Demasiadas solicitudes. Intente más tarde.',
  },
  // ... more languages
};

export function i18nMiddleware(req: Request, res: Response, next: NextFunction) {
  // Parse Accept-Language header
  const acceptLanguage = req.headers['accept-language'] || 'en';
  const lang = acceptLanguage.split(',')[0].split('-')[0]; // 'en-US' -> 'en'

  // Attach translation function to request
  req.t = (key: string, params?: Record<string, string>) => {
    const langStrings = translations[lang] || translations['en'];
    let str = langStrings[key] || translations['en'][key] || key;

    // Simple interpolation: {{param}}
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(new RegExp(`{{${k}}}`, 'g'), v);
      });
    }

    return str;
  };

  req.lang = lang;
  next();
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      t: (key: string, params?: Record<string, string>) => string;
      lang: string;
    }
  }
}
```

### Usage in Routes

```typescript
// Before
return res.status(404).json({ error: 'Job not found' });

// After
return res.status(404).json({ error: req.t('job.not_found') });
```

### Translation File Structure (Backend)

```
backend/src/i18n/
├── index.ts           # Middleware + loader
├── locales/
│   ├── en.json
│   ├── es.json
│   ├── zh.json
│   └── ...
```

**`en.json`**
```json
{
  "errors": {
    "job.not_found": "Job not found",
    "job.already_accepted": "Job has already been accepted",
    "job.wrong_status": "Cannot {{action}} job in {{status}} status",
    "payment.rejected": "Payment rejected",
    "payment.insufficient": "Payment amount (${{actual}}) is less than agreed price (${{expected}})",
    "payment.verification_failed": "Payment verification failed",
    "auth.invalid": "Invalid email or password",
    "auth.unauthorized": "Not authorized",
    "rate_limit": "Too many requests. Try again in {{time}}."
  },
  "notifications": {
    "job.new_offer": "New job offer: {{title}} for ${{price}}",
    "job.accepted": "Your job offer was accepted",
    "job.paid": "Payment received for {{title}}",
    "job.completed": "Job completed: {{title}}"
  }
}
```

### Email Translation

```typescript
// backend/src/lib/email.ts
import { getTranslation } from '../i18n';

export async function sendJobOfferEmail(params: JobOfferEmailParams) {
  const t = getTranslation(params.lang || 'en');

  const subject = t('email.job_offer.subject', { title: params.jobTitle });
  const body = t('email.job_offer.body', {
    name: params.humanName,
    title: params.jobTitle,
    price: params.priceUsdc.toString(),
    description: params.jobDescription,
  });

  // ... send email
}
```

### Telegram Translation

```typescript
// backend/src/lib/telegram.ts
export async function sendJobOfferTelegram(params: TelegramParams) {
  const t = getTranslation(params.lang || 'en');

  const message = t('telegram.job_offer', {
    title: params.jobTitle,
    price: params.priceUsdc.toString(),
    agent: params.agentName || t('common.unknown_agent'),
  });

  // ... send message
}
```

---

## Database Changes

### Store User Language Preference

```prisma
model Human {
  // ... existing fields

  preferredLanguage  String  @default("en")  // ISO 639-1 code
}
```

### API: Update Language

```
PATCH /api/humans/me
{
  "preferredLanguage": "es"
}
```

---

## Frontend-Backend Sync

### Request Header

Frontend sends language with every request:

```typescript
// frontend/src/api/client.ts
import i18n from '../i18n';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  config.headers['Accept-Language'] = i18n.language;
  return config;
});
```

### Response Format

Backend always includes language in response (for debugging):

```json
{
  "error": "Trabajo no encontrado",
  "_lang": "es"
}
```

---

## Translation Workflow

### For Developers

1. Add English string to `en.json`
2. Use translation key in code
3. Run extraction script (optional)
4. Create PR

### For Translators

1. Copy `en.json` to new language file
2. Translate all values (keep keys same)
3. Test in app
4. Submit for review

### Automation Options

- **Manual**: Human translators (highest quality)
- **AI-assisted**: Claude/GPT for first pass, human review
- **Crowdsourced**: Community translations
- **Service**: Lokalise, Crowdin, Phrase (paid)

---

## Implementation Phases

### Phase 1: Frontend Basics
- [ ] Install react-i18next
- [ ] Set up translation files (English only)
- [ ] Replace all hardcoded strings with `t()` calls
- [ ] Add LanguageSwitcher component
- [ ] Test language detection

### Phase 2: Add Languages
- [ ] Translate to Spanish (largest non-English market)
- [ ] Translate to Chinese (high crypto adoption)
- [ ] Add 2-3 more based on user data

### Phase 3: Backend Translation
- [ ] Create i18n middleware
- [ ] Translate error messages
- [ ] Translate email templates
- [ ] Translate Telegram messages

### Phase 4: Polish
- [ ] Store language preference in database
- [ ] Sync across devices
- [ ] RTL support (Arabic, Hebrew) if needed
- [ ] Date/number formatting per locale

---

## Testing Checklist

- [ ] Language detection works on first visit
- [ ] Language persists after page refresh
- [ ] Language switcher updates all text immediately
- [ ] Backend errors display in correct language
- [ ] Emails sent in user's preferred language
- [ ] Telegram messages in correct language
- [ ] No untranslated strings (missing key warnings)
- [ ] Interpolation works (e.g., "Hello, {{name}}")
- [ ] Pluralization works where needed

---

## Open Questions

1. **RTL support?** Arabic, Hebrew need right-to-left layout. Significant CSS work.
2. **Machine translation for MVP?** Use GPT-4 for initial translations, refine later?
3. **Currency formatting?** Show "$50" or "50 USD" or "50 USDC"?
4. **Date formatting?** MM/DD/YYYY vs DD/MM/YYYY per locale?
5. **URL structure?** `/es/dashboard` vs `?lang=es` vs subdomain?

---

## Resources

- [react-i18next docs](https://react.i18next.com/)
- [i18next docs](https://www.i18next.com/)
- [ICU Message Format](https://unicode-org.github.io/icu/userguide/format_parse/messages/)
- [ISO 639-1 Language Codes](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes)
