# Android App (Capacitor)

**Status:** Planned
**Priority:** High
**Motivation:** Play Store presence for SEO/credibility (20K+ download target), OS-level notification detection for reachability scoring, reliable FCM delivery for developing-market workers on budget Android phones, viral referral loop for supply-side growth
**Estimated effort:** 3-5 days engineering (Claude Max parallel agents) + 1-6 weeks Play Store review
**Complexity tier:** Standard
**Dependencies:** None (wraps existing frontend)
**Engineering capacity:** Claude Max — parallel agent sessions for concurrent development. Schema, API, Capacitor scaffold, and tests can run simultaneously. Human-gated blockers (legal review, real device testing, Play Store review) are the actual critical path.

## Senior Review Status

**Reviewed by:** 3 senior engineers (backend architect, mobile/Capacitor specialist, product/growth expert)

**Blockers fixed in this revision:**
- ✅ Message/Conversation schema: added `externalId`, `deliveryStatus`, `lastMessageAt` denormalization, cursor-based pagination
- ✅ Withdrawal model: added `idempotencyKey`, `externalTxHash`, `failureReason`, `recipientAddress`
- ✅ DeviceRegistration: fixed NULL deviceToken unique constraint issue
- ✅ Settlement architecture: full USDC flow diagram (escrow → off-chain credit → on-chain withdrawal)
- ✅ Chat polling: changed from 10s polling to FCM data messages + 30s adaptive polling fallback
- ✅ API spec: added auth matrix, error response format, cursor-based pagination, rate limiting thresholds
- ✅ K-factor: updated from optimistic 0.72 to realistic 0.16 (median worker)
- ✅ Performance targets: adjusted to realistic baselines (4.5s cold start, <20MB APK)
- ✅ UX red lines: added 5 missing patterns (auto-approve timeout, revision path, USDC visibility, task filtering, notification re-engagement)
- ✅ FCM reliability: added per-device delivery rates, battery whitelist guidance, token refresh handling
- ✅ Offline mode: added cache staleness, deduplication, thumbnail caching

**Human-gated blockers (cannot be solved by Claude agents):**
- ⚠️ **Crypto/legal compliance review** — lawyer must review custodial wallet model per target country ($2-5K, 2-3 weeks)
- ⚠️ **Play Store crypto policy pre-review** — attach compliance doc to submission, budget 1-6 weeks for review
- ⚠️ **Real device testing** — need physical Tecno Spark 10 + Samsung A14 for FCM delivery + cold start measurement
- ⚠️ **Agent-side demand validation** — need 10+ MCP agent partners posting 3+ tasks/week BEFORE production launch
- ⚠️ **Qualification test calibration** — needs 50+ real Filipino workers to validate 70-80% pass rate

---

## Value-Optimized Phasing

The original spec was engineer-brain: build everything, then ship. Maximum value means shipping the thinnest viable APK to Play Store in 2 days, then iterating with features that drive downloads and retention. Every phase below is ordered by **business value per engineering hour**, not technical dependency.

### Value Stack (what we're optimizing for)

| Value Driver | Mechanism | When It Kicks In |
|---|---|---|
| **Channel-agnostic chat** | Workers use whichever channel they prefer — app is just another window into the same conversation | Day 1 |
| **Play Store SEO** | App listing indexed by Google, keywords rank for "crypto jobs", "USDC freelance" | Day 1 on Play Store |
| **Credibility signal** | "Available on Google Play" badge on website, 20K+ download count | Week 1+ |
| **Viral referral loop** | Worker invites worker → both get bonus → exponential supply growth | V2 (week 2) |
| **Reachability signal** | OS-level notification permission → better job matching | V2 (week 2) |
| **Localized ASO** | Filipino, Spanish, Russian, Hindi Play Store listings → 35-50% higher conversion | V2 (week 2) |
| **Review flywheel** | In-app review prompts after task completion → higher Play Store ranking → more downloads | V3 (week 3) |
| **Offline + data saver** | Worker retention on budget phones/plans → lower churn | **V1 (day 1)** — persona testing showed this is a delete-the-app issue, not a nice-to-have |
| **Referral attribution** | Track which workers drive the most installs → reward top referrers | V3 (week 3) |
| **WhatsApp-native growth** | Referral links as WhatsApp messages, job alerts via WA, onboarding over WA | V2-V3 |
| **Instagram social proof** | Share earnings/badges to IG Story → followers see → install app | V3 (week 3) |
| **Zero-friction crypto onboarding** | Workers earn without knowing what USDC is → cash out in local currency | V2 (week 2) |

---

## Overview

Wrap the existing React/Vite/Tailwind frontend in a Capacitor shell to produce a native Android APK. The frontend is already 95% ready: safe-area CSS, responsive Tailwind (334+ breakpoints), PWA manifest, service worker, relative API URLs, BrowserRouter, device detection utility, and Vite code splitting (40+ lazy-loaded routes).

### Why This Matters

1. **Reachability signal.** We currently can't detect if a user has OS-level notifications enabled. Capacitor's `PushNotifications.checkPermissions()` gives us a direct boolean we can sync to the backend on every app open. This feeds the reachability score for matching.

2. **Play Store credibility.** In developing markets (Philippines, Venezuela, Nigeria, Russia, India), "it's on the Play Store" = legitimate platform. Workers install 10-30 gig apps. An app with 20K+ downloads and reviews signals trust.

3. **FCM reliability.** Firebase Cloud Messaging wakes devices from Doze mode, more reliable than web push on Android. Workers on cheap phones with aggressive battery optimization will actually receive notifications.

4. **Offline + data saver.** War room customer personas unanimously ranked offline job browsing and data saver mode as top priorities. Workers on 2-3GB/month prepaid plans won't keep using a data-hungry web app.

### What This Is NOT

- NOT a React Native rewrite (0% code reuse, 2-3 months)
- NOT a TWA wrapper (no native plugin access, no notification detection)
- NOT a native Kotlin app (3-4 months, separate codebase)
- NOT iOS (Android first — 85-95% market share in target markets)

---

## Core Principle: Channel-Agnostic Chat (NEW)

HumanPages is a chat-based platform — like YellowPages, but through conversational channels. Workers interact through whichever channel they prefer: Telegram, WhatsApp, the Android app, or the web. The channel is just a window into the same conversation. This is the foundational architecture decision that everything else builds on.

### What This Means for the Android App

The app is NOT a separate workspace with its own UI paradigm. It's another chat client showing the same conversation thread that exists on Telegram, WhatsApp, and web. A worker who:

1. Gets a job offer via Telegram
2. Replies "I'm interested" on Telegram
3. Opens the Android app

...should see that entire exchange in the app's chat view. And if they send a message from the app, the agent sees it in the same thread regardless of which channel it came through.

### Unified Conversation Model

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Telegram    │     │  WhatsApp   │     │  Android App │
│  Bot         │     │  Business   │     │  (Capacitor) │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────┬───────┴───────────────────┘
                   │
          ┌────────▼────────┐
          │   Conversation   │
          │   Service        │
          │                  │
          │  - Receives msgs │
          │    from any      │
          │    channel       │
          │  - Stores in     │
          │    unified       │
          │    Message table │
          │  - MCP agent     │
          │    processes &   │
          │    responds      │
          │  - Dispatches    │
          │    response via  │
          │    signup channel│
          │    (MVP) or last │
          │    active (V2)   │
          └────────┬────────┘
                   │
          ┌────────▼────────┐
          │  Conversation    │
          │  Store (DB)      │
          │                  │
          │  Messages[]      │
          │  - sender        │
          │  - content       │
          │  - channel       │
          │  - timestamp     │
          │  - jobId?        │
          └─────────────────┘
```

### Database Schema: Unified Messages

```prisma
model Conversation {
  id              String    @id @default(cuid())
  humanId         String
  human           Human     @relation(fields: [humanId], references: [id])
  jobId           String?   // scoped to a job if applicable, null for general/onboarding
  job             Job?      @relation(fields: [jobId], references: [id])
  status          String    @default("active") // "active", "archived", "resolved"
  lastMessageAt   DateTime? // denormalized — updated on every new message (avoids N+1 on conversation list)
  lastMessagePreview String? // first 100 chars of last message (avoids JOIN for conversation list)
  unreadCount     Int       @default(0) // denormalized — reset when worker opens conversation
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  messages        Message[]

  @@index([humanId, lastMessageAt]) // conversation list sorted by recency
  @@index([jobId])
  @@unique([humanId, jobId]) // one conversation per worker per job
}

model Message {
  id              String       @id @default(cuid())
  conversationId  String
  conversation    Conversation @relation(fields: [conversationId], references: [id])
  sender          String       // "human", "agent", "system", "bot"
  content         String       // message text
  contentType     String       @default("text") // "text", "image", "file", "action"
  channel         String       // "telegram", "whatsapp", "app", "web"
  externalId      String?      // channel-specific message ID (Telegram msg_id, WhatsApp msg_id) — for deduplication
  deliveryStatus  String       @default("sent") // "pending", "sent", "delivered", "read", "failed"
  metadata        Json?        // channel-specific data (telegram chat_id, delivery timestamps, etc.)
  jobId           String?      // denormalized for quick filtering
  createdAt       DateTime     @default(now())

  @@index([conversationId, createdAt])
  @@index([channel])
  @@unique([channel, externalId]) // prevent duplicate messages from webhook retries
}
```

**Schema design notes (from senior review):**
- `lastMessageAt` + `lastMessagePreview` on Conversation avoids N+1 queries when listing conversations. Without these, every conversation list page requires a JOIN + GROUP BY on Message table.
- `externalId` on Message is critical for Telegram/WhatsApp webhook deduplication. Webhooks can fire twice — without this unique constraint, you'd create duplicate messages.
- `deliveryStatus` tracks whether the message was actually received. Essential for A/B testing channel effectiveness and building the fallback cascade in V2.
- `unreadCount` is denormalized for the same reason as `lastMessageAt` — avoids counting unread messages per conversation on every page load.

### How Channels Map to the Conversation

| Channel | Inbound (worker → platform) | Outbound (platform → worker) |
|---|---|---|
| **Telegram** | Webhook receives message → create Message with `channel: "telegram"` | `sendTelegramMessage()` → also create Message record |
| **WhatsApp** | Webhook receives message → create Message with `channel: "whatsapp"` | WhatsApp Business API → also create Message record |
| **Android App** | REST API `POST /api/conversations/:id/messages` → create Message | FCM push with message preview + app shows in chat UI |
| **Web** | Same REST API | Web push + real-time via SSE/WebSocket |

### Key Architecture Rules

**Core principle: Unified Storage, Not Unified Delivery.** Store all messages in one table, display merged timeline in the app, but each channel handles its own delivery independently. Don't try to fan out messages across channels — that's over-engineering for pre-PMF.

1. **Every message is stored once, in the Conversation model.** Channels are just delivery/receive mechanisms.
2. **MVP: Reply on signup channel.** If a worker signed up via Telegram, all outbound messages go to Telegram. If they installed the app, outbound goes via FCM push. No cross-channel fallback cascade in V1.
3. **The AI agent doesn't care about channels.** The MCP-driven agent processes messages identically regardless of source. The only thing that changes is the delivery adapter at the end — which is selected by the worker's signup channel (MVP) or last-active channel (V2).
4. **The Android app shows the full conversation history** regardless of which channel each message came through. A small channel indicator (🔹 Telegram, 🟢 WhatsApp, 📱 App) can show where each message originated. Other channels (Telegram, WhatsApp) only show messages sent/received on that channel.
5. **A/B test notification channels per market.** When a new task is available, randomly assign a subset of workers to get notified via channel A vs channel B. Track click-through within 30 minutes. After a few hundred notifications, use the data to set default notification channel per country. This feeds the fallback cascade in V2.
6. **Existing `JobMessage` model should be migrated** to this unified model. The current `JobMessage` is job-scoped and doesn't track channel — it becomes a subset of this.
7. **The existing Telegram bot's fire-and-forget notifications become Messages** that are stored in the conversation. This is backwards-compatible — the bot still sends via Telegram API, but now also writes to the Message table.

### Channel Strategy Phases

| Phase | Behavior | Timeline |
|-------|----------|----------|
| **MVP** | Reply on signup channel only. No cross-channel fallback. App shows full merged timeline. | V1 (day 1) |
| **A/B Testing** | Randomly split notification delivery across channels per market. Measure open/click rates. Build per-country channel preference data. | V1-V2 (weeks 1-3) |
| **Smart Default** | Use A/B data to pick best first-try channel per market (e.g., FCM in Philippines, Telegram in Russia). Still single-channel delivery. | V2 (week 3+) |
| **Fallback Cascade** | If no delivery confirmation after X minutes on primary channel → try secondary channel. Informed by A/B data, not guesswork. | Post-MVP (when data justifies it) |
| **Full Omnichannel** | Cross-channel message syncing, read receipt unification, typing indicators across channels. | Probably never — only if usage data demands it |

### Impact on App Design

The frontend expert's review killed Design 2 (WhatsApp chat UX) on battery/performance grounds. But since the core product IS chat, the app MUST have a chat interface. The performance concerns are solvable:

- **Pagination:** Show last 30 messages, load more on scroll-up (not infinite DOM growth). Cursor-based pagination (not offset) for stable results when new messages arrive.
- **No typing indicator animation:** Use static "..." text instead of animated dots
- **Message delivery via FCM data messages (not polling).** When the MCP agent sends a response, backend fires an FCM data message to the worker's device containing the message payload. The app receives it instantly — no polling needed. Fallback: 30-second polling ONLY as a backup if FCM is unavailable (e.g., Google Play Services missing, notification permission denied).
- **Adaptive polling fallback:** Start at 30s when chat is open. If no new messages for 2 minutes, back off to 60s. Stop entirely when backgrounded. Resume at 30s on foreground.
- **Lazy-load images/files:** Only load media when the message is visible in viewport
- **Channel indicator:** Small emoji, not a rendered icon — zero image assets
- **Virtual scrolling:** Use `react-window` or `@tanstack/react-virtual` for message list. Never render all messages in DOM — only visible viewport + 5 messages above/below. Critical for 2GB RAM devices.

**Why not 10-second polling (from senior review):** On 2G/3G networks common in target markets, each poll is a full HTTP round-trip. At 10s intervals, polling consumes ~10% of available bandwidth and keeps the cellular radio active (draining 1-2% battery/minute). 30s polling cuts this by 3x. FCM data messages are the right approach because: (a) they're free, (b) they wake the device from Doze, (c) they arrive in <2 seconds, (d) they don't require the app to be actively polling.

The app's primary navigation becomes:

```
Chat | Tasks | Money | You
 ↑ primary — this is where work happens
```

Instead of:
```
Tasks | Active | Money | You
 ↑ this assumed a browse-and-apply model
```

### API Changes

```
GET  /api/conversations                    → list worker's conversations (sorted by lastMessageAt DESC)
GET  /api/conversations/:id                → conversation detail (participants, channels used, unread count)
GET  /api/conversations/:id/messages       → cursor-based pagination (newest first, 30 per page)
POST /api/conversations/:id/messages       → send message from app (creates Message with channel: "app")
POST /api/conversations/:id/read           → mark conversation as read (resets unreadCount)
```

**Pagination spec (cursor-based, not offset):**
```typescript
// Request
GET /api/conversations/:id/messages?cursor=msg_abc123&limit=30

// Response
{
  messages: Message[],       // 30 messages, newest first
  nextCursor: "msg_xyz789",  // pass as ?cursor= for next page (null if no more)
  hasMore: boolean
}

// Why cursor, not offset: new messages arriving while paginating don't shift the page.
// Offset-based pagination breaks when the dataset changes between requests.
```

**Auth matrix:**
```
GET  /api/conversations                    → worker auth (own conversations only)
GET  /api/conversations/:id                → worker auth (own) OR agent auth (assigned)
GET  /api/conversations/:id/messages       → worker auth (own) OR agent auth (assigned)
POST /api/conversations/:id/messages       → worker auth (own conversation only)
POST /api/conversations/:id/read           → worker auth (own)
GET  /api/humans/reachability/:humanId     → agent auth OR platform admin
POST /api/humans/device-status             → worker auth
POST /api/referrals/track-click            → public (rate limit: 10/min per IP, 50/day per code)
POST /api/referrals/claim                  → worker auth (idempotent — same code+worker returns cached result)
GET  /api/referrals/code                   → worker auth
GET  /api/referrals/stats                  → worker auth (own stats only)
GET  /api/earnings/balance                 → worker auth
GET  /api/earnings/recent-payments         → public (rate limit: 30/min per IP)
POST /api/earnings/withdraw                → worker auth (idempotent via idempotencyKey)
```

**Standard error response format:**
```typescript
// All error responses follow this shape
{
  error: {
    code: string,           // machine-readable: "RATE_LIMIT_EXCEEDED", "INVALID_CURSOR", "UNAUTHORIZED"
    message: string,        // human-readable: "Too many requests. Try again in 30 seconds."
    retryAfter?: number,    // seconds until retry is allowed (for 429s)
    details?: Record<string, string> // field-level validation errors
  }
}

// HTTP status codes used:
// 400 — validation error (bad input)
// 401 — unauthorized (no/expired token)
// 403 — forbidden (valid token but wrong role — worker calling agent endpoint)
// 404 — resource not found
// 409 — conflict (idempotency key already used with different payload)
// 429 — rate limited
// 500 — internal server error (log + alert, never expose internals)
```

### Migration Path

The current `JobMessage` model and Telegram notification code continue working during migration:

1. **Phase 1:** Add `Conversation` + `Message` models. New messages written to both old and new models.
2. **Phase 2:** Backfill existing `JobMessage` and `EmailLog` records into `Message` table.
3. **Phase 3:** Android app reads from new `Message` API. Telegram/WhatsApp webhooks write to new model.
4. **Phase 4:** Deprecate `JobMessage` model, read everything from `Conversation/Message`.

---

## Architecture

### How Capacitor Works

```
┌─────────────────────────────────┐
│         Android APK             │
│  ┌───────────────────────────┐  │
│  │    Native Android Shell   │  │
│  │  (Splash, Status Bar,     │  │
│  │   Deep Links, FCM)        │  │
│  │  ┌─────────────────────┐  │  │
│  │  │    Android WebView   │  │  │
│  │  │  ┌───────────────┐  │  │  │
│  │  │  │ React App      │  │  │  │
│  │  │  │ (Vite build)   │  │  │  │
│  │  │  │ Same codebase  │  │  │  │
│  │  │  └───────────────┘  │  │  │
│  │  └─────────────────────┘  │  │
│  └───────────────────────────┘  │
│  Capacitor Bridge (JS ↔ Native) │
└─────────────────────────────────┘
```

Every web deploy also ships to the app (via Capacitor's live update or APK rebuild). One codebase, two distribution channels.

### Capacitor Plugin Map

| Plugin | Purpose | Priority |
|--------|---------|----------|
| `@capacitor/push-notifications` | FCM + OS-level permission check | P0 |
| `@capacitor/secure-storage` | Encrypted token storage (replace localStorage) | P0 |
| `@capacitor/app` | Deep links, app state (foreground/background) | P1 |
| `@capacitor/status-bar` | Dark theme status bar styling | P1 |
| `@capacitor/splash-screen` | Branded launch screen | P1 |
| `@capacitor/network` | Online/offline detection for offline mode | P1 |
| `@capacitor/preferences` | Lightweight key-value storage for cached jobs | P2 |
| `@capacitor/badge` | Unread job count on app icon | P2 |

---

## User Flow

### Worker Installs App

```
1. Worker finds app on Play Store (search: "crypto jobs", "USDC freelance", "HumanPages")
2. Downloads (~15-20MB target APK size)
3. Opens → splash screen (brand purple #7C3AED, 1-2 seconds)
4. If new user: onboarding flow (same as web)
5. If existing user: login → dashboard with cached job listings
6. App requests notification permission (Android 13+)
7. Permission status synced to backend: POST /api/humans/device-status
```

### Notification Flow (Native vs Web)

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│ Job created  │────▶│ Backend      │────▶│ Is native app?  │
│ by agent     │     │ sends notif  │     │                 │
└─────────────┘     └──────────────┘     └────────┬────────┘
                                                   │
                                          ┌────────┴────────┐
                                          │                 │
                                     YES (FCM)         NO (Web Push)
                                          │                 │
                                   ┌──────▼──────┐  ┌──────▼──────┐
                                   │ Firebase     │  │ VAPID/Web   │
                                   │ Cloud Msg    │  │ Push API    │
                                   │ (wakes Doze) │  │ (best-effort│
                                   └─────────────┘  └─────────────┘
```

### FCM Reliability on Budget Devices (NEW — from senior review)

FCM does NOT guarantee delivery on budget Android devices. Manufacturers like Tecno, Xiaomi, Realme, and Samsung ship aggressive battery optimization that can block background processes — including FCM.

| Device | Doze Behavior | FCM Reliability (without whitelist) |
|---|---|---|
| Tecno Spark 10 | Aggressive — kills background in ~2min | 60-70% |
| Samsung A14 | Moderate — adaptive battery | 80-85% |
| Redmi 12C | Aggressive custom ROM | 50-60% |
| Realme C55 | Moderate but known FCM bugs | 75-80% |

**Mitigation:**
1. **Battery saver whitelist education.** After notification permission is granted, show a one-time guide: "To receive job alerts reliably, add HumanPages to your battery exceptions." Show device-specific instructions (Tecno vs Samsung vs Xiaomi — different settings paths).
2. **"Test notification" button in settings.** Worker taps → server sends test FCM → confirms delivery. If it doesn't arrive, show troubleshooting steps.
3. **FCM delivery tracking.** Log send timestamp on server + delivery acknowledgment on client. If delivery rate drops below 70% for a device model, flag for investigation.
4. **Token refresh handling.** FCM can issue new tokens anytime (OS update, app update, 6-month rotation). On `onTokenRefresh`: save to secure storage → async sync to backend with retry → backend upserts (finds existing device by humanId+platform, updates token, doesn't create duplicate).

**Pre-V2 requirement:** Run FCM delivery test on 10+ real devices. Send 100 notifications over 24h, measure: % delivered, % delivered on-time (<5min), % delivered while in Doze. If <70% on target devices, WhatsApp becomes the primary channel.

### Offline Job Browsing

```
1. App opens → fetches job listings from API
2. Caches last 50 job listings + low-res thumbnails in @capacitor/preferences (total ~500KB, within 2MB limit)
3. Each cached job includes `cachedAt` timestamp
4. Network drops → app detects via @capacitor/network
5. Shows cached listings with "Offline — last updated X minutes ago" banner
6. Jobs cached > 2 hours marked "May be unavailable"
7. User can browse, read details, mark favorites
8. Network returns → auto-refresh, sync favorites
9. Quick-apply from cached listing queues the application, sends on reconnect
10. Offline apply queue deduplicates by (workerId, jobId) — prevents double-applying
```

---

## Database Schema Changes

### New: DeviceRegistration model

```prisma
model DeviceRegistration {
  id            String   @id @default(cuid())
  humanId       String
  human         Human    @relation(fields: [humanId], references: [id], onDelete: Cascade)
  platform      String   // "android", "ios", "web"
  deviceToken   String?  // FCM token (null for web)
  appVersion    String?  // "1.0.0", "1.1.0"
  osVersion     String?  // "Android 13", "Android 14"
  deviceModel   String?  // "Samsung Galaxy A14", "Tecno Spark 10"
  notifPermission String @default("unknown") // "granted", "denied", "prompt", "unknown"
  lastActiveAt  DateTime @default(now())
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([humanId, platform, deviceToken]) // NOTE: deviceToken should never be NULL — use placeholder UUID for web platform
  @@index([humanId])
  @@index([platform])
}

// IMPLEMENTATION NOTE: When storing web platform devices, generate a stable device fingerprint
// (hash of User-Agent + screen resolution + timezone) as the deviceToken. Never store NULL —
// NULL breaks the unique constraint (PostgreSQL treats NULLs as distinct, allowing duplicates).
```

### New: Referral model

```prisma
model Referral {
  id            String    @id @default(cuid())
  referrerId    String
  referrer      Human     @relation("referralsMade", fields: [referrerId], references: [id])
  referredId    String?
  referred      Human?    @relation("referredBy", fields: [referredId], references: [id])
  code          String    @unique // short code like "MARIA-7K2"
  channel       String?   // "whatsapp", "telegram", "sms", "copy"
  clickedAt     DateTime?
  installedAt   DateTime?
  qualifiedAt   DateTime? // qualification test passed = reward triggered
  rewardGranted Boolean   @default(false)
  rewardAmount  Decimal?  @db.Decimal(18, 6) // $0.50 USDC per qualified referral
  createdAt     DateTime  @default(now())

  @@index([referrerId])
  @@index([code])
}
```

### Modified: Human model

```prisma
model Human {
  // ... existing fields ...

  // NEW — Device & Reachability
  deviceRegistrations DeviceRegistration[]
  reachabilityScore   Int?    @default(0) // 0-100, computed from device + engagement signals
  lastDeviceSync      DateTime? // Last time any device synced notification status
  signupChannel       String?  // "telegram", "whatsapp", "app", "web" — determines notification delivery in MVP

  // NEW — Referrals
  referralCode        String?  @unique // auto-generated on first app open
  referralsMade       Referral[] @relation("referralsMade")
  referredBy          Referral[] @relation("referredBy")
  priorityUntil       DateTime? // "Priority Worker" status from referral rewards
  referralCount       Int      @default(0) // denormalized for leaderboard queries
  lastReviewPromptAt  DateTime? // In-app review cooldown tracking
}
```

---

## API Changes

### New Endpoints

#### POST /api/humans/device-status (auth required)

Called on every app open to sync device state.

```typescript
// Request
{
  platform: "android" | "ios" | "web",
  deviceToken: string | null,       // FCM token
  appVersion: string,               // "1.0.0"
  osVersion: string,                // "Android 14"
  deviceModel: string,              // "Samsung Galaxy A14"
  notifPermission: "granted" | "denied" | "prompt"
}

// Response
{ ok: true, reachabilityScore: 72 }
```

#### GET /api/humans/reachability/:humanId (agent auth required)

Returns reachability score for matching decisions.

```typescript
// Response
{
  score: 72,                    // 0-100 composite
  channels: {
    pushNative: true,           // Has active FCM subscription with granted permission
    pushWeb: true,              // Has active web push subscription
    telegram: true,             // Has telegram chat ID
    whatsapp: false,            // No WhatsApp number
    email: true                 // Has email
  },
  lastActive: "2026-04-01T14:30:00Z",
  deviceCount: 2
}
```

#### GET /api/referrals/code (auth required)

Returns or generates the user's unique referral code and share URL.

```typescript
// Response
{
  code: "MARIA-7K2",
  shareUrl: "https://humanpages.ai/r/MARIA-7K2",
  stats: {
    clicks: 47,
    installs: 12,
    qualified: 8,    // qualification test passed = reward earned
    activeReferrals: 5  // still using platform after 7 days
  }
}
```

#### POST /api/referrals/track-click (public, rate-limited)

Called when someone clicks a referral link. No auth needed.

```typescript
// Request
{ code: "MARIA-7K2", channel: "whatsapp" }
// Response
{ ok: true }
```

#### POST /api/referrals/claim (auth required)

Called during onboarding if referral code is present. Awards rewards to both parties.

```typescript
// Request
{ code: "MARIA-7K2" }
// Response
{ ok: true, reward: "profile_highlight_48h", referrerReward: "0.50_usdc" }
```

### Modified Endpoints

#### POST /api/push/subscribe

Add platform detection: if request includes `fcmToken` field, store as native FCM subscription instead of web push.

#### Notification dispatch (lib/push.ts)

`sendPushToHuman()` modified to:
1. Determine worker's signup channel (stored in `DeviceRegistration`)
2. Dispatch via that channel (FCM for app installs, web push for web users, Telegram API for Telegram users)
3. Log delivery channel + delivery status for A/B testing analytics
4. No cross-channel fallback in V1 — single-channel delivery only (see Channel Strategy Phases)

---

## Frontend Changes

### New Files

| File | Purpose |
|------|---------|
| `frontend/src/lib/capacitorPush.ts` | Native push registration, permission check, FCM token management |
| `frontend/src/lib/capacitorBridge.ts` | Platform detection (`Capacitor.isNativePlatform()`), secure storage wrapper, offline detection |
| `frontend/src/hooks/useOfflineJobs.ts` | Cache job listings, detect offline state, show cached results |
| `frontend/src/components/OfflineBanner.tsx` | "You're offline — showing cached results" UI |
| `frontend/src/components/dashboard/ReferralCard.tsx` | "Invite Friends, Earn More" card on dashboard |
| `frontend/src/pages/referrals/ReferralStats.tsx` | Referral tracking page (clicks, installs, rewards) |
| `frontend/src/components/share/ShareToStory.tsx` | Instagram Story share with branded template |
| `frontend/src/components/share/WhatsAppShare.tsx` | Pre-formatted WhatsApp share with rich preview |
| `frontend/src/components/onboarding/CryptoExplainer.tsx` | "What is USDC?" explainer for first-time crypto users |
| `frontend/src/components/earnings/CashOutGuide.tsx` | Country-specific cash-out instructions |
| `frontend/capacitor.config.ts` | Capacitor project configuration |
| `frontend/android/` | Generated Android project (gitignored except config files) |

### Modified Files

| File | Change |
|------|--------|
| `frontend/src/lib/pushNotifications.ts` | Add platform branch: if native, delegate to `capacitorPush.ts` |
| `frontend/src/lib/safeStorage.ts` | Add secure storage backend when on native platform |
| `frontend/src/lib/api.ts` | Add `syncDeviceStatus()`, `getReachability()` API methods |
| `frontend/src/main.tsx` | Add Capacitor initialization, device status sync on app open |
| `frontend/src/pages/onboarding/steps/StepConnect.tsx` | Use native notification permission flow when on Capacitor |
| `frontend/src/components/dashboard/WorkStatusSection.tsx` | Show native notification toggle when on Capacitor |
| `frontend/vite.config.ts` | Ensure build output is Capacitor-compatible |

### Platform Detection Pattern

```typescript
// frontend/src/lib/capacitorBridge.ts
import { Capacitor } from '@capacitor/core';

export const isNative = () => Capacitor.isNativePlatform();
export const getPlatform = () => Capacitor.getPlatform(); // 'android', 'ios', 'web'

// Usage throughout the app:
if (isNative()) {
  // Use Capacitor plugins (FCM, secure storage, etc.)
} else {
  // Use existing web APIs (VAPID push, localStorage, etc.)
}
```

### Data Saver Mode

```typescript
// Check user preference (stored in app settings)
const dataSaver = await Preferences.get({ key: 'dataSaverMode' });

if (dataSaver.value === 'true') {
  // Request compressed images: append ?quality=low to image URLs
  // Skip loading profile photos in job listings (show initials instead)
  // Reduce job list page size from 20 to 10
  // Disable auto-loading of additional content
}
```

---

## Play Store Rollout Strategy (Psychology-Driven)

The rollout uses Google Play's testing tracks to build trust before going public. Workers in developing markets pattern-match new gig apps to known scams — "show money, can't access it, platform disappears." The only way to break that pattern is to prove money moves BEFORE asking strangers to trust you.

### Phase 0: Internal Testing (Week 1)

**Track:** Internal testing (max 100 testers, no Google review required, instant availability)
**Goal:** Verify the APK works — crypto flows, login, browsing, notifications. No real workers yet.

**Who:** Team members + friends with budget Android phones (Tecno, Samsung A-series, Redmi)
**What to test:** Privy auth in WebView, FCM delivery, data saver mode, offline banner, deep links, back button
**Exit criteria:** Zero crashes on 5+ device types, crypto balance displays correctly, FCM wakes Doze mode

### Phase 1: Closed Beta (Weeks 2-4)

**Track:** Closed testing (up to 2,000 testers via email list, reviews stay PRIVATE)
**Goal:** Prove money moves. Collect payment proofs, testimonials, and fix UX issues — all without risking public rating.

**Market:** Philippines ONLY (highest gig economy penetration, English-speaking, GCash for cash-out)
**Recruitment:** Direct outreach in Filipino gig worker Telegram/WhatsApp groups
**Target:** 200-500 testers, 50+ completing tasks daily

**Critical: Seed the marketplace.**
- Fund 20-30 real tasks internally ($60-100 total) before inviting testers
- Task types: storefront photography in Cebu/Manila, Tagalog translation, image labeling
- Workers complete real tasks, get real USDC, withdraw to real GCash accounts
- Goal: every tester completes at least 1 paid task within 48 hours of joining

**Collect trust assets during beta:**
- GCash withdrawal screenshots (ask workers to share voluntarily)
- 30-second video testimonials in Tagalog ("I earned ₱250 in 2 hours on HumanPages")
- Payment proof for the "Recent Payments" feed (anonymized real withdrawals)
- Bug reports and UX friction feedback

**Duration:** Minimum 14 days with 12+ active testers (Google's requirement before promotion to production). Plan for 3-4 weeks to also build trust assets.

**Exit criteria:**
- 50+ workers have withdrawn real money to GCash/bank
- 10+ video testimonials collected
- "Recent Payments" feed has 14+ days of real withdrawal data
- Average task completion time matches estimates (±20%)
- No "where is my money" complaints in the tester WhatsApp group
- Play Store private feedback is 4.0+ stars

### Phase 2: Production Launch (Week 5+)

**Track:** Production (public listing, staged rollout)
**Goal:** Go public with proof that money moves. First public reviews come from beta workers who already earned.

**Market:** Philippines first. Expand to Nigeria/India only after hitting density thresholds (see Market Activation Thresholds section).

**Staged rollout:** 5% → 25% → 50% → 100% over 2 weeks. Monitor reviews at each stage.

**Play Store listing uses trust assets from beta:**
- Screenshots showing real earnings and task completion
- Description: "Join 500+ workers in Philippines earning $2-5 per task" (real number, not inflated)
- Feature graphic includes GCash withdrawal proof
- First wave of public reviewers = satisfied beta testers (ask them to leave reviews on production)

**Go/No-Go checklist for production launch:**
- [ ] 50+ workers have been paid out in closed beta
- [ ] 10+ testimonials collected (video + screenshot)
- [ ] Recent Payments feed has 14+ days of data
- [ ] Task density: ≥ 5 available tasks/day in Philippines
- [ ] Average time-to-first-task < 24 hours for new workers
- [ ] No unresolved "where is my money" complaints
- [ ] Private beta feedback ≥ 4.0 stars

---

## Implementation Phases (Value-Optimized)

### V1: "Build the APK + Submit to Internal/Closed Testing" — Ship in 2 Days

**Goal:** Working APK on internal testing track. NOT public yet. Start closed beta recruiting while the APK is being tested.

#### Session 1A: Capacitor Scaffold + Minimal Native (Day 1)

1. Install Capacitor core + CLI in frontend project
2. Initialize Android project (`npx cap init`, `npx cap add android`)
3. Install ONLY essential plugins: push-notifications, app, status-bar, splash-screen
4. Configure `capacitor.config.ts` (app ID: `ai.humanpages.app`)
5. Set up Firebase project, download `google-services.json`
6. Splash screen (brand purple #7C3AED) + app icon (adaptive)
7. Status bar dark theme (#0F172A)
8. Android back button handling
9. Build + sync: `npm run build && npx cap sync android`
10. Test APK on emulator — verify core flows work (login, browse jobs, view profile)

#### Session 1B: Play Store Setup + Internal Testing Track (Day 1-2, parallel with 1A)

1. Create Play Store developer account ($25 one-time)
2. Generate signed AAB
3. Upload to **internal testing track** (available immediately, no review)
4. Add team members as internal testers (up to 100)
5. Prepare closed testing listing (will be promoted after internal validation):

**English (Philippines focus):**
- Title: "HumanPages — Earn Crypto for Tasks"
- Short: "Real tasks from AI companies. $2-5 per task. Withdraw to GCash."
- Keywords: crypto jobs, USDC freelance, AI tasks, earn crypto, micro-tasks, gig economy crypto

**Filipino (Tagalog) — V1 launch market:**
- Title: "HumanPages — Kumita ng Crypto sa mga Task"
- Short: "Real na tasks mula sa AI companies. $2-5 bawat task. I-withdraw sa GCash."

**Other languages (add ONLY when that market is activated — see Market Activation Thresholds):**
- Spanish (LATAM): "HumanPages — Gana Crypto por Tareas"
- Hindi: "HumanPages — टास्क करके क्रिप्टो कमाएं"
- Russian: Only if Russia market decision (HUM-264) is GO

6. Screenshots — 6 per language (task feed, task detail, earnings page, cash-out guide, referral card, notification)
7. Feature graphic (1024x500) — "Real tasks. Real money. Withdraw to GCash."
8. Privacy policy URL
9. Content rating questionnaire
10. Submit to **closed testing track** (NOT production) with email list of recruited beta testers

**Why Philippines-only at launch:** Psychological research showed that launching globally with thin task density triggers "this is a scam" pattern recognition in developing markets. Better to be strong in 1 market than weak in 5. Add markets only after hitting density thresholds.

#### Session 1C: "Available on Google Play" Website Badge (Day 2)

1. Add Google Play badge to HumanPages website:
   - Homepage hero section
   - Worker onboarding page
   - Footer
2. Add `<meta>` app-link tags for SEO: `<meta property="al:android:url" content="humanpages://...">`
3. Add Smart App Banner for Android browsers (custom, not iOS-only)
4. Update OG tags: "Now available on Google Play"

#### Session 1D: Data Saver Mode (Day 1-2, parallel with 1A/1B) — MOVED FROM V3

Persona testing showed data cost is a delete-the-app issue in target markets. Chidi (Nigeria, 2GB/month plan) said "If this app eats my data, I delete it. Period." This can't wait until V3.

1. Add data saver toggle in settings (prominent, not buried)
2. Auto-enable for workers in developing markets (detect country via IP geolocation)
3. When enabled: compress image thumbnails (append `?quality=low`), show initials instead of profile photos in job lists, reduce page size from 20 to 10, disable auto-load of additional content
4. Show toast on first enable: "Data saver is on — saving your mobile data"
5. Track data usage per session (display in settings: "~1.2MB used this session")

**V1 ships with:** Working APK on internal + closed testing tracks, Filipino/English Play Store listing, data saver mode auto-enabled, qualification flow, Recent Payments feed. NOT public yet — closed beta runs for 2-4 weeks to prove money moves before going to production. Website badges wait until production launch.

---

### V2: "Growth Engine" — Week 2

**Goal:** Viral referral loop + reachability signal + FCM. This is where the app starts generating value beyond just existing.

#### Session 2A: Referral System (THE highest-value feature)

A referral system is the single highest-ROI feature for a supply-constrained marketplace. DoorDash pays $200-600 per driver referral because supply-side acquisition is the bottleneck. We have the same problem.

**How it works:**

```
1. Worker opens app → sees "Invite Friends, Earn More" card on dashboard
2. Taps → gets unique referral link: humanpages.ai/r/{code}
3. Shares via WhatsApp, Telegram, SMS (native share sheet)
4. Friend taps link → deferred deep link opens Play Store → installs → opens app
5. Friend completes profile → BOTH get reward
6. Referrer gets priority matching for next 7 days (sees jobs 5 min before non-referrers)
```

**Referral rewards (REDESIGNED based on persona + psychology analysis):**
- **Referrer:** $0.50 USDC cash bonus when referred worker completes their QUALIFICATION TEST (not first task — decouples referrer from marketplace density)
- **Referred:** Profile highlighted to agents for 48h after qualification
- **Milestone bonuses (cash):** 5 qualified referrals → $5 bonus. 20 → $20 + "Community Leader" badge. 50 → $50 + leaderboard feature.
- **Cap:** 20 referral bonuses per worker per month ($10 max)

Why qualification trigger (not first task): If the bonus depends on the referee completing a task, the referrer is hostage to marketplace density — if there are no tasks, they blame HumanPages AND the friend they referred. Tying it to qualification means the referrer gets paid for successful recruitment, and marketplace performance is decoupled from referral rewards. This eliminates the "I referred my cousin but he can't find work so where's my money" resentment loop.

**Database changes:** See canonical Referral model in Database Schema Changes section above. Key fields: `qualifiedAt` (triggers reward), `rewardAmount` ($0.50 USDC), `rewardGranted` (idempotency guard).
```

**New API endpoints:**

```
GET  /api/referrals/code          → returns user's unique referral code + share URL
POST /api/referrals/track-click   → logs when someone clicks a referral link (public)
POST /api/referrals/claim         → called during onboarding if referral code present
GET  /api/referrals/stats         → referrer sees: clicks, installs, qualified, rewards
```

**Frontend:**
- New `ReferralCard.tsx` on dashboard — prominent, above the fold
- Native share sheet integration via `@capacitor/share`
- Referral stats page (my referrals, pending, completed)
- Deep link handler: extract referral code from URL, store, apply during signup

#### Session 2B: Native Push + Notification Permission + Reachability (parallel with 2A)

1. Create `capacitorPush.ts` — register FCM, get token, sync to backend
2. Create `capacitorBridge.ts` — platform detection
3. Modify `pushNotifications.ts` — branch web vs native
4. Create backend endpoint: `POST /api/humans/device-status`
5. Add `DeviceRegistration` Prisma model + migration
6. Modify `sendPushToHuman()` — FCM priority over web push
7. Add device status sync on app open in `main.tsx`
8. Reachability score computation + API endpoint
9. Reachability column in admin dashboard

#### Session 2C: Secure Storage Migration (parallel with 2A, 2B)

1. Install `@capacitor/secure-storage`
2. Create storage wrapper: secure storage on native, localStorage on web
3. Migrate JWT token storage
4. Migrate any sensitive preferences
5. Verify: no tokens accessible via ADB on native

---

### V3: "Retention + Reviews" — Week 3

**Goal:** Keep workers coming back. Get Play Store reviews. Optimize for budget hardware.

#### Session 3A: In-App Review Prompts (HIGH value for ranking)

Play Store ranking is heavily influenced by review count and rating. A well-timed review prompt can 5x your review rate.

**Trigger timing (based on best practices):**
- NOT on first launch, NOT during onboarding
- After completing 3rd task (user has experienced value)
- After receiving payment (positive moment)
- After 5th app open (demonstrated engagement)
- Max once per 30 days (Google enforces a quota anyway)

```typescript
// Review prompt logic
const shouldPromptReview = (
  tasksCompleted >= 3 &&
  appOpens >= 5 &&
  daysSinceLastPrompt >= 30 &&
  lastPaymentReceivedWithin24h
);

if (shouldPromptReview) {
  // Use Capacitor App Rate plugin or Google Play In-App Review API
  await AppRate.requestReview();
  await trackEvent('review_prompted');
}
```

**Database:** Add `lastReviewPromptAt` to Human model.

#### Session 3B: Offline Mode (data saver already in V1)

1. Create `useOfflineJobs.ts` hook — cache last 50 jobs in Preferences
2. Create `OfflineBanner.tsx` component
3. Add @capacitor/network listener for online/offline transitions
4. Implement offline job queue (mark favorites, queue applications)
5. Quick-apply from cached listing queues the application, sends on reconnect

*Note: Data saver mode moved to V1 based on persona testing results. See Session 1D.*

#### Session 3C: Bundle Optimization + Device Testing

1. Analyze bundle: identify routes consuming most space
2. Reduce initial bundle to <15MB (aggressive code splitting)
3. Lazy-load heavy dependencies (recharts, wagmi, viem) only when needed
4. Test cold start on Tecno Spark 10 emulator profile (2GB RAM, eMMC)
5. Implement virtual scrolling (`react-window`) for job lists and chat messages — required for 2GB RAM devices
6. Target: <4.5 second cold start (stretch: <3s)
7. Battery drain baseline measurement
8. Test on 3G network simulation

#### Session 3D: Deep Links + Attribution

1. Configure Android App Links for `humanpages.ai` domain
2. Referral deep links: `humanpages.ai/r/{code}` → Play Store → app with code preserved
3. UTM parameter tracking: which channel drove which install
4. Attribution dashboard in admin: installs by source (organic, referral, direct)

---

### V4: "Compound Growth" — Week 4+

#### Session 4A: Referral Leaderboard (Social Proof)

1. Public leaderboard: "Top Referrers This Month"
2. Country-specific leaderboards (Philippines, Venezuela, Nigeria, Russia, India)
3. Milestone notifications: "You're 2 referrals away from Community Builder!"
4. Share referral stats as image (for WhatsApp/Telegram status)

#### Session 4B: Smart Notification Timing

1. Track when each user typically opens the app (time-of-day patterns)
2. Send job notifications during their active window, not at 3am
3. Reduce notification frequency for low-engagement users (prevent uninstall)
4. Increase frequency for high-engagement users (they want more)

#### Session 4C: Auto P2P Conversion Prompt (Venezuelan persona request)

1. After task payment, show: "Convert your USDC? Popular options in your country:"
2. Link to Binance P2P / local exchange with pre-filled amounts
3. Country-specific: Binance P2P for Venezuela, GCash for Philippines, Luno for Nigeria

#### Session 4D: Play Store A/B Testing

1. Set up Custom Store Listings for A/B testing screenshots
2. Test: task-focused screenshots vs earnings-focused screenshots
3. Test: English screenshots vs localized screenshots in each market
4. Quarterly screenshot refresh based on winners

---

## WhatsApp-Native Growth (cuts across V2-V4)

WhatsApp is the internet in developing markets. 2B+ monthly active users, 70%+ penetration in Philippines, Nigeria, India, Latin America. The app's growth strategy must be WhatsApp-native, not "share button that happens to include WhatsApp."

### 1. Referral Messages as WhatsApp-Formatted Content (V2)

Don't just share a URL. Share a formatted WhatsApp message that looks like it came from a friend, not a bot:

```
Hey! I've been earning $2-5 per task on HumanPages — AI agents hire you directly and pay in USDC (no fees). I made $47 last week doing translations and data tasks 💰

Try it: humanpages.ai/r/MARIA-7K2

It's free. You don't even need a crypto wallet — they explain everything.
```

**Implementation:**
- `WhatsAppShare.tsx` component with pre-formatted message templates
- Use `https://wa.me/?text=` deep link (works without WhatsApp Business API)
- Templates localized per language (Filipino message for PH contacts, Spanish for LATAM, etc.)
- Include referral code in URL — tracked through deferred deep link
- A/B test message variants: earnings-focused vs ease-focused vs social-proof

### 2. WhatsApp Job Alerts (V3)

Workers already told us (persona feedback) that they check apps manually, not via notifications. But they DO check WhatsApp constantly. If we can send job alerts TO WhatsApp, we bypass the entire notification problem.

**Flow:**
```
1. Worker enables "WhatsApp alerts" in app settings
2. Worker enters or confirms WhatsApp number
3. Backend sends job matches via WhatsApp Business API template message
4. Message includes: job title, pay, one-tap "Apply" link (deep link back to app)
5. Worker taps → app opens → job detail → apply
```

**Why this matters:** This is the real answer to the reachability question. Not "can we detect Chrome notifications" — but "can we reach them on the channel they actually live on." WhatsApp delivery + read receipts give us the signal we wanted.

**WhatsApp Business API costs (2026):** Per-template-message pricing varies by country. India: ~$0.005/msg, Brazil: ~$0.03/msg, Nigeria: ~$0.02/msg. At $0.01 average, 1000 alerts/day = $10/day = $300/month. Cheap for the engagement uplift.

**Template message example (must be pre-approved by Meta):**
```
🔔 New task for you on HumanPages!

"{{1}}" — ${{2}} USDC
Posted {{3}} ago

Tap to apply: {{4}}
```

### 3. WhatsApp Onboarding Assistant (V4)

For workers who are intimidated by the app or have low smartphone literacy, offer a WhatsApp-based onboarding flow:

```
Worker clicks referral link → option: "Set up via WhatsApp" or "Open app"
→ WhatsApp chat opens with HumanPages bot
→ Bot walks through: name, skills, location, photo (send via WA)
→ Profile created. "Your profile is live! Download the app for faster access: [link]"
```

This captures workers who would have bounced from the app's onboarding. Profile completion via WhatsApp, app download as optional upgrade.

---

## Instagram Social Proof (V3-V4)

Instagram isn't for acquiring workers directly — it's for social proof. When workers share earnings or badges to their IG Story, their followers see it and ask "what's that?"

### 1. Shareable Earnings Card (V3)

After completing a task or receiving payment, show: "Share your earnings?"

Generates a branded image:
```
┌──────────────────────────────┐
│  🟣 HumanPages              │
│                              │
│  I just earned $4.50 USDC    │
│  translating a document      │
│  for an AI agent 🤖          │
│                              │
│  humanpages.ai/r/MARIA-7K2   │
│  ─── Earn crypto for tasks ──│
└──────────────────────────────┘
```

**Implementation:**
- Generate image on device using Canvas API (no server round-trip)
- Brand colors (purple #7C3AED, dark #0F172A)
- Include referral code in image + as text overlay
- Share to IG Story via Android Intent (ACTION_SEND to com.instagram.android)
- Also works for WhatsApp Status, Telegram stories, Twitter/X

### 2. Badge Achievements (V4)

Shareable milestone cards:
- "First task completed! 🎉"
- "Earned $100 on HumanPages 💯"
- "Community Builder — referred 5 workers 🏗️"
- "Top Earner this week in Philippines 🇵🇭"

These create FOMO. Friends see the card, think "I want that too", follow the link.

### 3. Instagram Profile Link (V2)

Prompt workers to add their HumanPages referral link to their IG bio:
```
"Add your referral link to your Instagram bio and earn priority matching every time someone signs up!"
```

This is free, permanent, and compounds — every worker's IG bio becomes a distribution channel.

---

## Zero-Friction Crypto Onboarding (V2)

The war room and personas both identified this: most workers in target markets have never held USDC. If the app says "earn USDC" and the worker has to figure out wallets, seed phrases, and gas fees — they're gone. 90% drop-off.

### Design Principle: Earn First, Learn Crypto Later

Workers should complete their first task and see money in their account before they ever think about "what is USDC." The crypto is the payment infrastructure, not the value proposition.

### Onboarding Flow (for workers with no crypto experience)

```
Step 1: Sign up (name, skills, photo) — NO wallet setup required
Step 2: Browse jobs, accept one, complete it
Step 3: Payment arrives → "You earned $4.50!" (shown in USD, not "4.50 USDC")
Step 4: Earnings page shows balance in USD equivalent
Step 5: Worker taps "Cash out" → country-specific guide appears:

  🇵🇭 Philippines: "Send to GCash via Coins.ph" [step-by-step]
  🇻🇪 Venezuela: "Convert on Binance P2P" [step-by-step]
  🇳🇬 Nigeria: "Send to bank via Luno" [step-by-step]
  🇷🇺 Russia: "P2P sell on Bybit" [step-by-step]
  🇮🇳 India: "Withdraw via WazirX/CoinDCX" [step-by-step]

Step 6: First cash-out triggers "What is USDC?" explainer (optional, dismissible)
```

### Key UX Decisions

1. **Show USD, not USDC.** The earnings page, job listings, and notifications all show "$4.50" not "4.50 USDC". The crypto denomination only appears in the cash-out flow and settings.

2. **Custodial-first.** Workers don't manage keys. HumanPages holds USDC in a platform wallet (like Coinbase holds funds for users). Workers can withdraw to their own wallet if they want (advanced), or cash out through local exchanges.

3. **Country-specific cash-out guides.** Not a generic "how to use USDC" page. Actual step-by-step screenshots for the most popular exchange in each target country. Updated quarterly.

4. **No wallet setup in onboarding.** The profile form asks for: name, skills, location, photo. NOT a wallet address. That's collected only when they try to withdraw. Workers who never withdraw still contribute to the marketplace — their profile is live, agents can hire them.

### Database Changes

```prisma
model Human {
  // existing fields...

  // NEW — Crypto onboarding
  platformBalance   Decimal  @default(0) @db.Decimal(18, 6) // USDC held by platform
  walletAddress     String?  // Set only when worker requests self-custody withdrawal
  preferredCurrency String   @default("USD") // Display currency: USD, PHP, VES, NGN, RUB, INR
  cashOutMethod     String?  // "gcash", "binance_p2p", "luno", "bybit", "wazirx", etc.
  firstTaskAt       DateTime? // Track time-to-first-task for onboarding optimization
  firstCashOutAt    DateTime? // Track conversion funnel
}
```

### New API Endpoints

```
GET  /api/earnings/balance          → { usdBalance: "47.50", usdcBalance: "47.50", pendingPayments: 2 }
GET  /api/earnings/cash-out-guide   → country-specific guide content (markdown)
POST /api/earnings/withdraw         → initiate USDC transfer to worker's wallet or exchange
GET  /api/earnings/history          → transaction history with USD display
```

### Settlement Architecture (NEW — from senior review)

How USDC actually moves through the system. This is the most critical backend flow — every reviewer flagged its absence.

```
Agent posts task ($5 USDC budget)
       │
       ▼
┌──────────────────┐
│ Agent pays via    │  Agent's wallet → Platform escrow wallet
│ x402 or direct   │  (on-chain transfer, wait for 1 confirmation)
│ USDC transfer    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Escrow held      │  Platform wallet holds USDC until task approved
│ (platform wallet)│  Worker sees "$5.00 pending" in earnings
└────────┬─────────┘
         │  Agent approves (or auto-approve after 72h timeout)
         ▼
┌──────────────────┐
│ Worker balance    │  Platform credits worker's platformBalance
│ credited          │  Worker sees "$5.00 available"
│ (off-chain)       │  NO on-chain transfer yet (gas-free for worker)
└────────┬─────────┘
         │  Worker taps "Cash out"
         ▼
┌──────────────────┐
│ Withdrawal        │  Platform wallet → Worker's exchange/wallet
│ initiated         │  On-chain USDC transfer (Base L2 for low gas)
│                   │  Gas fee: ~$0.01-0.05 on Base (absorbed by platform)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Confirmation      │  Wait for 1 block confirmation (~2 sec on Base)
│ + status update   │  Update Withdrawal.status → "completed"
│                   │  Update Withdrawal.externalTxHash
└──────────────────┘
```

**Key design decisions:**
1. **Off-chain crediting.** When an agent approves a task, the worker's `platformBalance` increments immediately (database update, no blockchain). This is instant and gas-free. The on-chain transfer only happens at withdrawal.
2. **Base L2 for withdrawals.** Gas on Base is $0.01-0.05 vs $1-5 on Ethereum mainnet. Platform absorbs gas fees — workers never see gas costs.
3. **1-confirmation finality.** Base has ~2 second block times. We wait for 1 confirmation before marking withdrawal complete. For amounts > $100, wait for 3 confirmations.
4. **Escrow timeout.** If agent doesn't approve/reject within 72h, auto-approve and credit worker. Prevents "money stuck in limbo" pattern.
5. **Retry logic.** If on-chain transfer fails (network congestion, RPC error), retry with exponential backoff: 30s → 2m → 10m → 1h. Max 5 retries. After 5 failures, mark as "failed" with reason and alert ops.

**Settlement endpoints (backend only — not exposed to workers):**

```
POST /api/internal/escrow/hold        → agent payment received, hold in escrow
POST /api/internal/escrow/release     → task approved, credit worker balance
POST /api/internal/escrow/refund      → task cancelled, refund agent
POST /api/internal/withdrawals/process → cron job: process pending withdrawals in batch
GET  /api/internal/withdrawals/status  → ops dashboard: failed/stuck withdrawals
```

**Compliance requirements (BLOCKER — founder/legal):**
- Money transmission licensing per target country (PH, NG, IN, VE, RU)
- Circle USDC terms of service confirmation for this use case
- AML/KYC: workers earning > $600/year may trigger reporting requirements (US) or equivalent thresholds in local jurisdictions
- Sanctions screening: Russian workers may be blocked by Circle/OFAC. Must have clear policy before activating Russia market.
- Play Store crypto policy pre-review: attach compliance document to submission explaining HumanPages is a marketplace, not an exchange or custodial wallet

### Metrics to Track

| Event | What It Tells Us |
|---|---|
| `profile_completed_no_wallet` | % of workers who onboard without crypto knowledge |
| `first_task_completed` | Time from signup to first task (target: < 24h) |
| `cash_out_guide_viewed` | Which countries are trying to cash out |
| `cash_out_completed` | Conversion from earning to actual money in hand |
| `cash_out_method_selected` | Which exchanges are popular per country |
| `usdc_explainer_viewed` | How many workers want to understand the crypto layer |
| `usdc_explainer_dismissed` | How many don't care (and that's fine) |
| `withdrawal_failed` | Which exchange/method is failing + why |
| `settlement_latency_p95` | Time from "cash out" tap to money on-chain (target: < 30s) |
| `gas_fee_per_withdrawal` | Track Base L2 gas costs (alert if > $0.10) |

---

## Developing Market UX Optimizations (cuts across all versions)

### 1. Minimal Onboarding (V1)

Get to first meaningful moment FAST. 41% of gig platforms use automated onboarding in 2026.

```
Current: Sign up → 7-step profile wizard → wait for job offer → ???
Optimized: Sign up (name + 1 skill) → see available jobs immediately → complete profile later

"You can browse jobs now. Complete your profile to apply."
```

Defer everything non-essential: photo, full skill list, equipment, languages. Ask for these AFTER they've seen jobs and want to apply. Each piece of missing profile data becomes a prompt: "Add a photo to increase your chances by 3x."

### 2. Low-Data Mode Default (V2)

In developing markets, default to low-data mode. Don't make workers find a toggle in settings.

```typescript
// On first app open, detect country via IP geolocation
const lowDataCountries = ['PH', 'VE', 'NG', 'IN', 'KE', 'BD', 'PK'];
if (lowDataCountries.includes(userCountry)) {
  await Preferences.set({ key: 'dataSaverMode', value: 'true' });
  // Show toast: "Data saver is on — saving your mobile data 📱"
}
```

### 3. Language Auto-Detection (already exists, enhance)

Your frontend already has i18next with browser language detection. Enhance for the app:
- Detect device language, not browser language
- Support: English, Filipino, Spanish, Russian, Hindi, Portuguese, Arabic
- Job listings: show machine-translated previews with "View original" option
- Notifications in user's language

### 4. Light Theme Option (V3)

Your app is dark theme (#0F172A). In developing markets, many workers use phones outdoors in bright sunlight. Dark themes are hard to read. Offer a light theme toggle, or auto-switch based on ambient light / time of day.

### 5. Notification Permission Framing (V2)

Don't ask "Allow notifications?" on first open — it's meaningless. Ask AFTER the worker has accepted their first job:

```
"You've been hired! 🎉

Turn on notifications so you never miss a job offer.
Workers with notifications enabled earn 3x more."

[Enable Notifications]  [Maybe Later]
```

Frame it as "earn more", not "allow notifications." This is the highest-conversion moment for permission requests.

---

## Psychology-Driven Onboarding Flow (NEW — from behavioral analysis)

Workers in developing markets use a three-gate trust model: (1) Is this platform real? (2) Does money actually move? (3) Can I earn? The onboarding must pass all three gates in order. Mentioning money before Gate 2 is cleared triggers "signup casino" pattern recognition → immediate abandonment.

### The Flow (exact screens)

**Screen 1: Market Verification (auto-detected)**
```
📍 You're in: Philippines

HumanPages is live in Philippines.
Tasks available for English and Tagalog speakers.

[Continue]
```
If NOT in an active market:
```
📍 You're in: Ghana

HumanPages is coming to West Africa.
We'll notify you when tasks are available in your area.

[Notify me when available]
```
This collects email + skills + country for the waitlist. No empty marketplace shown.

**Screen 2: What is HumanPages (60 seconds, no money promises)**
```
🎯 Real Work. Real Money.

HumanPages connects AI companies with workers
who complete micro-tasks.

Typical tasks: Data labeling, transcription, content review
Time per task: 5-30 minutes

We use crypto so you get paid with no bank fees.

[Build Your Profile]
```

**Screen 3: Profile Setup (2 minutes)**
```
Name, phone, language(s), time available per week.
Pick your top skill (big tappable buttons):
  📸 Photography  🏷️ Labeling  🌐 Translation
  ✅ Verification  🎙️ Transcription  📝 Writing
```
NO wallet setup. NO photo required. Defer everything non-essential.

**Screen 4: Qualification Test (5 minutes, unpaid)**
```
📋 Qualification Test

To make sure you can do quality work,
we have a 5-minute test. It's unpaid, but
it's the same as the real tasks.

[Start Qualification]
```
This creates buy-in (7 minutes invested = escalation of commitment) and weeds out low-effort signups. Workers who pass feel they earned access.

**Screen 5: Result**
PASS → show available tasks immediately (the trust payoff)
FAIL → "Score: 60%. Passing: 75%. Try again or join waitlist for new task types."

**Screen 6: Task Feed (only shown after qualification)**
If tasks available:
```
📋 Available Tasks (12)

✓ Content Review — $3
  "Review 5 images for brand safety"
  Estimated time: 8 min | Completed by others: 847 times
```
"Completed by others: 847 times" is the social proof signal — someone else did this and presumably got paid.

If NO tasks right now:
```
No tasks available right now.
Next task expected: ~2 hours

[Tab: See recent payments to other workers]

  45 min ago: ₱150 → GCash
  2 hours ago: ₱145 → Bank transfer
  3 hours ago: ₱180 → GCash
```
The Recent Payments tab is the critical trust signal. Never show an empty marketplace without also showing that money IS moving.

**Notification Permission (contextual — AFTER first apply)**
```
You just applied! 🎉
Get notified when you're hired.

Workers with notifications earn 3× more.

[Enable Notifications]  [Maybe Later]
```

### Key Psychology Rules

1. **No money mention until Screen 2.** Screen 1 is about location legitimacy.
2. **No balance display until after qualification.** Showing $0.00 before context triggers "signup casino" pattern.
3. **Qualification creates investment.** Workers who invest 7 minutes are less likely to leave a 1-star review over minor issues.
4. **"Completed by others" = implicit payment proof.** If 847 people did this task, they presumably got paid.
5. **Recent Payments feed = explicit payment proof.** Money moving in real-time breaks the "is this a scam?" loop.
6. **Notification permission after first apply, not on first open.** The worker has context now — they want to know if they got hired.

---

## Recent Payments Trust Feed (NEW — from behavioral analysis)

The single most powerful trust signal for a new gig platform. Shows anonymized, real-time withdrawals from other workers. Solves 80% of "where is my money" paranoia without the worker having to earn first.

### Implementation

```
GET /api/earnings/recent-payments → public endpoint, rate-limited

Response:
{
  payments: [
    { amount: "150", currency: "PHP", method: "GCash", minutesAgo: 45 },
    { amount: "145", currency: "PHP", method: "Bank transfer", minutesAgo: 120 },
    { amount: "180", currency: "PHP", method: "GCash", minutesAgo: 180 }
  ],
  todayTotal: { amount: "3847", currency: "PHP" },
  todayCount: 24
}
```

### Display (in Wallet tab + "No tasks available" screen)

```
🏦 Recent Payments (real-time)

45 min ago: ₱150 → 📱 GCash
2 hours ago: ₱145 → 🏦 Bank transfer
3 hours ago: ₱180 → 📱 GCash
4 hours ago: ₱120 → 🏦 Bank transfer
6 hours ago: ₱200 → 📱 GCash

Total paid to workers today: ₱3,847
```

### Rules
- Only show payments from the worker's country (Philippine workers see PHP withdrawals, not NGN)
- Anonymized — no names, no wallet addresses
- Real data only — NEVER fake these numbers. If there are no payments today, show yesterday's.
- If there are genuinely zero payments ever (pre-launch), DON'T show this section. It only appears once the first real withdrawal has happened.
- Update every 5 minutes when the app is open (not real-time WebSocket — too battery-expensive)

### Database

```prisma
model Withdrawal {
  id               String   @id @default(cuid())
  humanId          String
  human            Human    @relation(fields: [humanId], references: [id])
  amount           Decimal  @db.Decimal(18, 6)
  currency         String   // "PHP", "NGN", "INR", "VES", "RUB"
  method           String   // "gcash", "bank_transfer", "binance_p2p", "luno", "upi"
  status           String   @default("pending") // "pending", "processing", "completed", "failed"
  idempotencyKey   String   @unique // client-generated UUID — prevents double-withdrawal on retry
  externalTxHash   String?  // blockchain tx hash or exchange transfer ID — for audit/reconciliation
  recipientAddress String?  // wallet address, GCash number, or bank account (masked in logs)
  failureReason    String?  // why it failed (API error, insufficient balance, sanctions, etc.)
  retryCount       Int      @default(0)
  gasFee           Decimal? @db.Decimal(18, 6) // blockchain gas fee (deducted from amount or absorbed)
  completedAt      DateTime?
  createdAt        DateTime @default(now())

  @@index([currency, completedAt]) // for recent payments query
  @@index([humanId, createdAt])    // for worker's withdrawal history
  @@index([status])                // for processing queue
}
```

**Withdrawal design notes (from senior review):**
- `idempotencyKey` is critical — if Luno/Binance API times out and we retry, this prevents double-sending. Client generates UUID, backend deduplicates.
- `externalTxHash` links our internal record to the actual on-chain or exchange transfer. Without this, reconciliation and audit are impossible.
- `failureReason` enables debugging and user-facing error messages ("Exchange unavailable, try again in 1 hour").
- `recipientAddress` stored for audit trail. Masked in any API response or log (show only last 4 chars).

---

## UX Red Lines — What to NEVER Do (NEW — from behavioral analysis)

These patterns are guaranteed to trigger negative reactions in developing markets. Non-negotiable.

### Copy Red Lines

NEVER say in the app or Play Store listing:
- ~~"Start earning today"~~ (broken promise if no tasks available)
- ~~"Unlimited earning potential"~~ (triggers skepticism — sounds like MLM)
- ~~"Get paid instantly"~~ (creates speed expectation that crypto can't always meet)
- ~~"No qualifications needed"~~ (signals low quality / scam)
- ~~"Passive income"~~ (triggers "pyramid scheme" pattern in developing markets)
- ~~"Join thousands earning $5000/month"~~ (obvious scam bait)

### UX Red Lines

NEVER show:
1. **A $0.00 balance before first qualification.** Anchors to zero, triggers "signup casino" pattern.
2. **"0 available tasks"** as a number. Say "Next task expected: ~2 hours" instead.
3. **A disabled Withdraw button** with "Minimum $25". This is the casino pattern — money visible but locked.
4. **Referral bonuses as "pending"** before they're earned. "Pending: $1.50 (3 referrals waiting)" = "where is my money" trigger.
5. **Countdown timers on anything.** "Bonus expires in 3 days" = artificial urgency = scam signal.
6. **Notifications about OTHER workers' earnings.** "Maria just earned $4!" = FOMO if you can't earn yet.
7. **A "Recent tasks" section that shows $0.00 earned.** Only show earnings history after first earning.
8. **A loading spinner that hangs.** "Tasks loading..." for >3 seconds = "the app is broken."

### Referral Red Lines

NEVER:
1. Show pending referral bonuses before they're confirmed/paid
2. Make referral bonuses depend on the referee's task performance (creates blame asymmetry)
3. Show "Refer 5 friends to unlock premium features" (MLM pattern)
4. Show multi-level referral tracking ("your referral referred someone") — pyramid scheme territory

### Task & Review Red Lines (NEW — from senior review)

NEVER:
1. Show "Waiting for agent review" without a timeout guarantee. Always show: "Your submission is pending review. If not reviewed within 24h, you'll be paid automatically."
2. Show rejection feedback without a revision path. Worker must always see: "Agent requested changes. You can revise and resubmit once."
3. Show the word "USDC" in the main flow (job feed, earnings, notifications). Use "$" everywhere. Only show "USDC" in cash-out guidance and settings.
4. Show a task the worker can't complete (e.g., "verified storefront photos" to a worker without a verified profile). Filter > showing and rejecting.
5. Permanently disable notifications without asking why. After 7 days of disabled notifications, show in-app: "You turned off job alerts. Want to re-enable? Workers with alerts earn 3x more."

### Geographic Red Lines

NEVER:
1. Geo-block without explanation (worker thinks the app is broken)
2. Show a list of available countries that doesn't include theirs (feels like rejection)
3. Show an empty marketplace to workers in unsupported markets (triggers 1-star reviews)

---

## Acceptance Criteria

### V1 (Ship to Closed Testing — NOT production)
- [ ] App installs from signed APK on Android 10+ devices
- [ ] Existing login flow works (Privy auth, JWT token in WebView)
- [ ] Dashboard loads with job listings (same data as web)
- [ ] Back button navigates correctly (back through history, exit on home)
- [ ] Splash screen shows brand assets on cold start
- [ ] Status bar matches dark theme
- [ ] APK on internal testing track (100 testers)
- [ ] APK promoted to closed testing track with Filipino beta tester email list
- [ ] APK size < 25MB
- [ ] Data saver mode toggle visible in settings
- [ ] Data saver auto-enabled for workers in Philippines
- [ ] Data saver reduces image quality and page sizes when enabled
- [ ] Qualification flow works (5-min test → pass/fail → task feed access)
- [ ] Recent Payments feed shows real withdrawal data (or hidden if no data)
- [ ] "No tasks available" screen shows "Next task expected: ~Xh" instead of "0 tasks"
- [ ] Geo-detection shows correct market status (active vs "coming soon")
- [ ] No $0.00 balance shown before qualification
- [ ] Notification permission asked AFTER first task application, not on first open

### Production Launch Gate (promote from closed beta)
- [ ] 50+ workers have withdrawn real money in closed beta
- [ ] 10+ video/screenshot testimonials collected
- [ ] Recent Payments feed has 14+ days of real data
- [ ] Task density ≥ 5/day in Philippines
- [ ] Average time-to-first-task < 24 hours
- [ ] Closed beta private feedback ≥ 4.0 stars
- [ ] No unresolved "where is my money" complaints
- [ ] Play Store listing uses real testimonials and earnings screenshots

### V2 (Growth Engine)
- [ ] Referral code generated for every user
- [ ] Share sheet works via WhatsApp, Telegram, SMS, copy link
- [ ] Referral deep link → Play Store → app → code preserved through install
- [ ] Referrer reward ($0.50 USDC) triggers when referred worker completes QUALIFICATION TEST
- [ ] Referred worker's profile highlighted to agents for 48h post-qualification
- [ ] Referral bonus capped at 20/month per worker
- [ ] No "pending" referral bonuses shown — only confirmed/paid
- [ ] Referral stats visible to user (clicks, installs, qualified)
- [ ] Push notifications received via FCM when app is backgrounded
- [ ] Push notifications received via FCM when app is killed (Doze wake)
- [ ] `checkPermissions()` correctly reports OS-level notification status
- [ ] Device status synced to backend on every app open
- [ ] Reachability score computed and accessible via API
- [ ] No JWT tokens in localStorage on native platform (all in secure storage)
- [ ] APK reverse engineering reveals no embedded secrets

### V2 (Developing Market Onboarding)
- [ ] Earnings displayed in USD by default (not "USDC")
- [ ] No wallet setup required during onboarding
- [ ] Country-specific cash-out guides for PH, VE, NG, RU, IN
- [ ] Platform balance tracked per worker (custodial)
- [ ] Minimal onboarding: name + 1 skill → see jobs immediately
- [ ] Data saver auto-enabled for workers in low-data countries
- [ ] Notification permission asked AFTER first job acceptance, not on first open
- [ ] WhatsApp referral shares use localized pre-formatted messages (not just a URL)

### V3 (Retention + Social)
- [ ] In-app review prompt triggers after 3rd task completion
- [ ] Review prompt respects 30-day cooldown
- [ ] Offline mode: cached job listings shown when network drops
- [ ] Offline banner displayed when offline
- [ ] Data saver mode reduces image quality and page sizes
- [ ] Quick-apply from notification works (tap notification → job detail → apply)
- [ ] Deep links open correct pages (`humanpages.ai/jobs/:id` → app job detail)
- [ ] Cold start < 4.5 seconds on Tecno Spark 10 profile (2GB RAM) (stretch: < 3s)
- [ ] APK size < 20MB (stretch: < 15MB after optimization)
- [ ] Shareable earnings card generates branded image with referral code
- [ ] Share to IG Story / WhatsApp Status works via Android Intent
- [ ] WhatsApp job alerts delivered via Business API template messages
- [ ] Instagram bio prompt shown to workers after 3rd referral

---

## Reachability Score Formula

```
score = 0

// Channel availability (max 90)
if (nativeFCM && notifPermission === 'granted')  score += 30
if (webPushActive)                                 score += 20
if (telegramConnected)                             score += 15
if (whatsappConnected)                             score += 15
if (emailVerified)                                 score += 10

// Engagement recency (max 10, min -20)
if (lastActiveWithin24h)    score += 10
if (lastActiveWithin7d)     score += 5
if (noEngagement14d)        score -= 20

// Clamp to 0-100
score = Math.max(0, Math.min(100, score))
```

A reachability score of 70+ means the user will almost certainly see a notification within minutes. Below 30 means they're essentially a ghost.

---

## Crypto Integration Testing (NEW — pre-development verification)

The Android app wraps a WebView, but crypto flows (wallet connection, USDC display, payment confirmations) behave differently in WebView vs browser. Every crypto touchpoint must be tested in the Capacitor WebView specifically.

### Critical Crypto Flows to Test

| Flow | What Can Break in WebView | Test Method |
|---|---|---|
| Privy auth (email/social login) | OAuth popups blocked by WebView | Capacitor InAppBrowser for OAuth, not WebView popup |
| Wallet connection (WalletConnect) | Deep links to MetaMask/Coinbase Wallet may not resolve | Test all 3: WalletConnect modal, Coinbase SDK, manual address |
| USDC balance display | WebSocket connections for real-time balance may be throttled in background | Verify balance refreshes on app foreground via Capacitor `appStateChange` |
| Payment confirmation | On-chain confirmation polling may drain battery | Batch poll every 30s when app is active, stop entirely when backgrounded |
| Cash-out initiation | Exchange deep links (Luno, Binance) may not open from WebView | Use Capacitor `Browser.open()` for external links, not `window.open()` |
| x402 payment flow | HTTP 402 → payment → retry may timeout in slow networks | Add retry logic with exponential backoff, show "Payment processing..." state |

### WebView-Specific Crypto Restrictions

```typescript
// Known WebView issues with crypto:
// 1. window.ethereum is NOT injected in WebView (no browser extension wallets)
// 2. WalletConnect v2 requires WebSocket — verify it works in Android WebView
// 3. Privy's embedded wallet may have different behavior in WebView vs browser
// 4. localStorage is shared between WebView sessions — secure storage migration critical

// Test matrix:
const cryptoTestMatrix = {
  privy_email_login: ['WebView', 'Chrome Custom Tab'],
  privy_social_login: ['WebView redirect', 'InAppBrowser popup'],
  walletconnect_v2: ['WebView WebSocket', 'Native WebSocket fallback'],
  usdc_balance_fetch: ['Foreground poll', 'Background suspend', 'Resume refresh'],
  payment_confirmation: ['Fast 4G', '3G simulation', 'Intermittent connection'],
  exchange_deep_links: ['Luno installed', 'Luno not installed', 'Binance installed'],
};
```

### Acceptance Criteria (Crypto)

- [ ] Privy email login works in Capacitor WebView (no popup blocked)
- [ ] Privy social login (Google, Apple) works via InAppBrowser redirect
- [ ] USDC balance displays correctly and refreshes on app foreground
- [ ] Balance polling stops when app is backgrounded (no battery drain)
- [ ] Cash-out links to exchanges open correctly (Browser.open, not WebView)
- [ ] WalletConnect v2 session persists across app backgrounding
- [ ] Payment confirmation works on 3G network simulation (with retry)
- [ ] No wallet-related data in localStorage (all in secure storage)
- [ ] Embedded Privy wallet works identically in WebView and browser

---

## Device Compatibility Matrix (NEW — pre-development verification)

Target markets use a wide range of budget devices. The app must work on the actual phones workers use, not just Pixel emulators.

### Screen Size & Ratio Testing

| Category | Devices | Resolution | Ratio | Priority |
|---|---|---|---|---|
| Ultra-budget (2GB RAM) | Tecno Spark 10, Tecno Pop 7, Itel A60 | 720×1600 | 20:9 | P0 — most workers |
| Budget (3-4GB RAM) | Samsung Galaxy A14, Realme C55, Xiaomi Redmi 12C | 1080×2400 | 20:9 | P0 |
| Mid-range | Xiaomi Redmi Note 12, Poco X5, Samsung A34 | 1080×2400 | 20:9 | P1 |
| Older budget | Samsung J7, Redmi 9A, Nokia 2.4 | 720×1520-1600 | 19:9-20:9 | P1 |
| Small screen | Nokia 1.4, Alcatel 1B | 720×1440 | 18:9 | P2 — uncommon but exists |
| Tablet (rare) | Samsung Tab A8 | 1200×1920 | 16:10 | P3 — very few workers |

### Android Version Support

| Android Version | API Level | Market Share (target markets) | Support |
|---|---|---|---|
| Android 14+ | 34+ | ~15% | Full support |
| Android 13 | 33 | ~25% | Full support (notification permission required) |
| Android 12/12L | 31-32 | ~20% | Full support |
| Android 11 | 30 | ~20% | Full support |
| Android 10 | 29 | ~12% | Minimum supported version |
| Android 9 (Pie) | 28 | ~5% | NOT supported (Capacitor 5 minimum is API 29) |
| Android 8.x | 26-27 | ~3% | NOT supported |

**Decision:** API 29 (Android 10) minimum. This covers ~92% of devices in target markets. Android 9 users are declining rapidly and Capacitor 5 doesn't support it.

### Language/RTL Testing

| Language | Script | Direction | Test Priority |
|---|---|---|---|
| English | Latin | LTR | P0 |
| Filipino (Tagalog) | Latin | LTR | P0 |
| Spanish (LATAM) | Latin | LTR | P0 |
| Hindi | Devanagari | LTR | P0 |
| Russian | Cyrillic | LTR | P1 (pending market decision HUM-264) |
| Arabic | Arabic | RTL | P2 (future market) |
| Portuguese (Brazil) | Latin | LTR | P2 (future market) |
| Amharic | Ge'ez | LTR | P2 |

**RTL note:** Current UI is LTR-only. If Arabic market is targeted in future, Tailwind's `rtl:` variants will need to be added. Not a V1 concern.

### Performance Baselines

| Metric | Stretch Target | Realistic Target | How to Measure |
|---|---|---|---|
| Cold start | < 3s on 2GB RAM | < 4.5s on 2GB RAM | Android Studio profiler on Tecno Spark 10 profile |
| Time to interactive | < 5s on 3G | < 7s on 3G | Chrome DevTools throttled network |
| Memory usage (idle) | < 150MB | < 200MB | Android Studio memory profiler |
| Memory usage (active browsing) | < 250MB | < 350MB | Android Studio memory profiler |
| Battery drain (30 min active use) | < 8% | < 12% | Manual test on real device |
| APK size | < 15MB | < 20MB | AAB analyzer |
| First paint (Largest Contentful Paint) | < 2.5s | < 3.5s | Lighthouse in WebView |
| JS bundle (main) | < 300KB gzipped | < 500KB gzipped | Vite build analysis |

**Performance notes (from senior review):**
- React + Vite + Tailwind + Capacitor plugins typically ship at 18-22MB AAB. <15MB requires aggressive tree-shaking and lazy-loading of crypto libraries (wagmi, viem).
- Cold start on Tecno Spark 10 is 4-6s for a typical React WebView app. <3s requires: (a) minimal first-render component tree, (b) no synchronous imports of heavy libraries, (c) splash screen covering the gap.
- Virtual scrolling (`react-window`) is required, not optional, for job lists and chat on 2GB RAM devices.
- Plan a 2-day optimization sprint after first working APK. Measure real numbers, then optimize bottlenecks.

### Acceptance Criteria (Compatibility)

- [ ] App installs and runs on Android 10 (API 29) emulator
- [ ] All core flows work on 720×1600 (20:9) screen
- [ ] All core flows work on 720×1440 (18:9) screen
- [ ] No text truncation or overflow on smallest supported screen
- [ ] Job listing cards readable on 720p width
- [ ] Onboarding form fields don't overlap keyboard on small screens
- [ ] App runs without crash on 2GB RAM device profile (Tecno Spark 10)
- [ ] Cold start < 4.5 seconds on 2GB RAM profile (stretch: < 3s)
- [ ] All UI text displays correctly in Filipino, Spanish, Hindi, Russian
- [ ] Number formatting correct per locale (₱, Bs, ₦, ₹, ₽)
- [ ] Date formatting correct per locale
- [ ] Font rendering correct for Devanagari (Hindi) and Cyrillic (Russian)

---

## Test Coverage Plan (NEW — pre-development verification)

### Unit Tests (Jest + React Testing Library)

| Module | Tests Required | Priority |
|---|---|---|
| `capacitorBridge.ts` | Platform detection (web vs native), getPlatform() returns correct value | P0 |
| `capacitorPush.ts` | FCM registration, token refresh, permission check, token storage | P0 |
| `useOfflineJobs.ts` | Cache storage, cache eviction (FIFO at 50), offline detection, queue sync | P0 |
| `safeStorage.ts` | Secure storage on native, localStorage fallback on web, migration path | P0 |
| Reachability score | Score computation matches formula, edge cases (all channels, no channels) | P1 |
| Referral code generation | Uniqueness, format (NAME-XXX), collision handling | P1 |
| Data saver mode | Toggle persistence, image URL rewriting, page size reduction | P1 |
| Cash-out guide selection | Correct guide per country, fallback for unknown country | P1 |
| Device status sync | Correct payload construction, debouncing (not on every render) | P1 |
| Referral deep link parsing | Extract code from URL, handle malformed URLs, handle no code | P1 |

### Integration Tests (Playwright or Detox)

| Flow | What to Test | Priority |
|---|---|---|
| Onboarding → first job browse | Full flow from app open to seeing job listings | P0 |
| Notification permission flow | Request timing (after first job acceptance), grant, deny, "maybe later" | P0 |
| Referral share → deep link | Generate link, share sheet opens, simulate click → app opens with code | P1 |
| Offline → online transition | Cache loads, banner shows, network returns, fresh data replaces cache | P1 |
| Data saver toggle | Enable → images compress, disable → images restore | P1 |
| Cash-out flow | Balance display, tap cash out, guide loads for correct country | P1 |
| Push notification tap → job detail | Notification arrives, tap opens correct job | P1 |

### E2E Tests (Real Device Farm — BrowserStack or Firebase Test Lab)

| Test Suite | Devices | Priority |
|---|---|---|
| Smoke test (install, login, browse) | 5 devices: Tecno Spark 10, Samsung A14, Redmi 12C, Realme C55, Nokia 2.4 | P0 — run on every release |
| Performance test (cold start, LCP) | 3 devices: Tecno Spark 10, Samsung A14, Redmi Note 12 | P0 |
| Crypto flow (login, balance, cash-out link) | 2 devices: Samsung A14, Redmi Note 12 | P0 |
| Full regression | 10 devices across all screen sizes | P1 — run weekly |

### Test Infrastructure

```
CI pipeline:
1. npm run test:unit        → Jest + RTL (every commit)
2. npm run test:integration → Playwright on Capacitor (every PR)
3. npm run test:e2e         → Firebase Test Lab on 5 real devices (every release)
4. npm run test:perf        → Lighthouse CI + custom cold start measurement (every release)
```

---

## Notification Management (NEW — pre-development verification)

Beyond basic FCM, the notification system needs careful management to avoid annoying workers (→ disable notifications → become unreachable → leave platform).

### Notification Types & Frequency Limits

| Type | Content | Max Frequency | Channel Priority |
|---|---|---|---|
| Job match | "New task: [title] — $[amount]" | 5/day | Signup channel (see Channel Strategy Phases) |
| Job accepted | "You've been hired for [title]!" | Unlimited (event-driven) | Signup channel |
| Payment received | "You earned $[amount]!" | Unlimited (event-driven) | Signup channel |
| Task reminder | "Your task [title] is due in 2h" | 1 per task | Signup channel |
| Referral milestone | "[Name] qualified! You earned $0.50" | 3/day max | Signup channel |
| Review prompt | "Enjoying HumanPages? Rate us!" | 1 per 30 days | In-app only (NOT push) |
| Platform update | "New feature: [description]" | 1/week max | Signup channel |
| Re-engagement | "You have 3 new tasks matching your skills" | 1 per 3 days (only if inactive 48h+) | Signup channel (A/B test alternate channels) |

### Notification Preferences UI

```
Settings → Notifications:
  ☑ Job matches (recommended)
  ☑ Payment confirmations
  ☑ Task reminders
  ☐ Referral updates
  ☐ Platform news

  Quiet hours: [10 PM] to [7 AM] (auto-detected from timezone)

  [Notification sound: Default ▼]
```

### Smart Notification Timing

```typescript
// Don't send notifications during quiet hours
// Don't send if user disabled that notification type
// Don't send re-engagement if user was active in last 48h
// Batch low-priority notifications (referral, platform news) into daily digest
// Track: sent, delivered, opened, dismissed — use for frequency optimization

interface NotificationDecision {
  shouldSend: boolean;
  channel: 'fcm' | 'whatsapp' | 'email' | 'in-app';
  delay?: number; // ms to wait (for batching)
  reason?: string; // why suppressed (for debugging)
}
```

### Notification Grouping (Android)

```xml
<!-- Android notification channels (required for Android 8+) -->
<channel id="job_matches" name="Job Matches" importance="high" />
<channel id="payments" name="Payments" importance="high" />
<channel id="task_reminders" name="Task Reminders" importance="default" />
<channel id="referrals" name="Referral Updates" importance="low" />
<channel id="platform" name="Platform Updates" importance="low" />
```

Workers can disable specific channels in Android system settings, and the app respects this.

### Acceptance Criteria (Notifications)

- [ ] All notification types have correct Android channel assignment
- [ ] Quiet hours suppress notifications (except payment confirmations)
- [ ] Notification preferences sync between app settings and backend
- [ ] Re-engagement notifications only fire after 48h+ inactivity
- [ ] Notification frequency limits enforced server-side (not just client)
- [ ] Notification tap opens correct screen (job detail, earnings, referral stats)
- [ ] Notification grouping works (multiple job matches collapse into summary)
- [ ] Notification sound respects user preference
- [ ] FCM delivery confirmed on Doze mode (device sleeping)
- [ ] A/B test infrastructure ready: can split notification delivery across channels per market

---

## Security Considerations

1. **Token storage.** All auth tokens MUST use `@capacitor/secure-storage` on native, NOT localStorage. The `safeStorage.ts` wrapper handles this transparently.
2. **APK secrets.** Never embed API keys, VAPID private keys, or secrets in the frontend build. All secrets stay on the backend.
3. **Notification payloads.** Validate all notification data in the service worker. Reject cross-origin URLs (already implemented in `sw.js`).
4. **FCM token rotation.** Handle token refresh events — re-register with backend when FCM issues a new token.
5. **Deep link validation.** Only handle deep links for `humanpages.ai` domain. Reject all others.
6. **WebView security.** Disable file:// access, disable JavaScript interfaces except Capacitor bridge.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Play Store crypto policy rejection | Medium | High | Pre-submission: document that we're a marketplace using a regulated stablecoin (USDC/Circle), not an exchange. No wallet creation, no trading. |
| WebView performance on 2GB RAM phones | Medium | Medium | Bundle optimization to <20MB (stretch <15MB). Test on Tecno Spark 10 profile. Virtual scrolling + aggressive lazy loading. |
| Workers don't download | Medium | Low | Low investment (2 weeks). Use WhatsApp as primary channel. App is optional upgrade. |
| Maintaining two push systems (FCM + web) | Low | Low | Abstracted behind single `subscribeToPush()` that detects platform. Existing `pushNotifications.ts` structure supports this. |
| Google Play Store review delays | Medium | Low | Submit early. Have compliance docs ready. Budget 1-3 weeks for review. |
| WalletConnect deep links fragile in WebView | Medium | Medium | Test wallet flows E2E in Capacitor. Fall back to manual address entry if deep links fail. |

---

## War Room Findings (Summary)

Full war room analysis: `specs/android-app-approach.md`

**Verdict:** GO WITH MAJOR CHANGES

**Critical issues addressed in this spec:**
1. ✅ Performance optimization — targets <4.5s cold start (stretch <3s), <20MB bundle (stretch <15MB)
2. ✅ Security audit — Phase D includes token migration + APK reverse engineering test
3. ✅ Offline mode — Phase C implements cached job browsing (top persona request)
4. ⚠️ Crypto compliance — Not an engineering task. Founder must get legal review of USDC payment flows before Play Store submission. This is the gate.

**Customer persona consensus:**
- #1 priority: Offline job browsing
- #2 priority: Data saver mode
- #3 priority: Quick-apply from notification
- Workers will uninstall if the app is "just the website in an icon"

---

## User Persona Stress Test Results

7 sub-agents ran simulated user journeys from different POVs: Filipino VA (Maria), Venezuelan crypto worker (Carlos), Nigerian student labeler (Chidi), Russian translator under sanctions (Anya), Indian data labeler (Priya), demand-side AI developer (Jake), and a skeptical Series A VC analyst. All were instructed to be brutally critical. Results below.

### Fatal Friction Points (raised by 5+ agents)

#### 1. Job Scarcity Is the App-Killer

Chidi (Nigeria) saw 8 jobs, 3 relevant to his skills. Priya (India) saw 3 jobs total, competing with 12 applicants for one. Jake (demand-side) pointed out the core problem: supply-side tooling with no marketplace density. The VC agent called the 20K download target "vanity metric theater" — at industry-standard 8% D30 retention, that's 1,600 MAU across 5 countries, or ~320 per country. Not enough for reliable task fulfillment.

**Spec gap:** No minimum task density threshold before market activation. Workers download, see an empty marketplace, uninstall, and leave 1-star reviews that tank Play Store ranking — the exact metric we're optimizing for.

**Required addition:** Market Activation Threshold system (see new section below).

#### 2. Crypto Onboarding Is a Wall, Not a Speed Bump

Chidi had to set up Luno mid-task-application and said "I don't actually know what just happened." Priya found the USDC→INR conversion path unclear. Anya (Russia) flagged sanctions uncertainty — USDC is technically accessible but Circle has complied with OFAC before, making trust zero. The VC agent called custodial wallets "a regulatory timebomb" and a potential money transmission classification.

**Spec gap (partially addressed):** The Zero-Friction Crypto Onboarding section handles the happy path well, but country-specific cash-out guides need to be tested end-to-end, not just documented. Workers need to see the FULL flow: "Your $4.50 → Luno → ₦6,750 in your bank" with actual screenshots, not placeholder instructions.

**Required addition:** Cash-out flow E2E testing as acceptance criteria for each target market.

#### 3. Unit Economics Don't Close

Priya calculated her effective rate at $2.67/hour — less than her Remotasks minimum ($3.50/hour on slow days). The VC agent pointed out HumanPages takes 0% from workers, making worker LTV literally $0. Revenue depends entirely on the agent/demand side, which the spec barely addresses. At $0 worker-side revenue, every acquisition dollar is a loss unless agent-side revenue offsets it — but the spec doesn't quantify this.

**Spec gap:** No unit economics model. No LTV calculation. No ARPPU target. No math showing how agent-side revenue covers worker acquisition costs.

**Required addition:** Unit Economics section (see below).

### Persona-Specific Findings

#### Chidi (Nigeria, Tecno Spark 10, 2GB RAM)
- Battery drain: 9% in 20 minutes of active use (0.45%/min). On a phone that lasts 4-6 hours of heavy use, this is a concern.
- No data saver toggle visible. Image thumbnails eating 1-2MB per browse session on a 2GB/month plan.
- "If this app eats my data, I delete it. Period."
- **Action:** Data saver mode MUST be V1, not V3. Auto-enable for developing markets.

#### Priya (India, Realme C55, 4GB RAM)
- Already uses 3 competing platforms simultaneously (Remotasks, Scale, Toloka). HumanPages needs to be 2x better on ONE specific dimension to steal her attention.
- Currently worse on every dimension except fees. But zero fees mean nothing with 3 available jobs vs Remotasks' 14+.
- Her effective hourly rate on HumanPages: $2.67/hour vs $3.50/hour minimum on Remotasks.
- **Action:** The zero-fee value prop only works if there's enough work. Sparse marketplace + zero fees = zero value.

#### Anya (Russia, Poco X5 Pro)
- No Russian localization on the website. No Russian profiles visible. "This platform was built for Brooklyn, not Novosibirsk."
- Clicked "Start your profile" on the website and nothing visibly happened. SPA navigation confusion.
- Sanctions uncertainty: she doesn't know if Circle/USDC will blacklist her wallet tomorrow.
- **Action:** If Russia is a target market, localize the app AND website. If it's not, remove Russian from the Play Store listing — false advertising drives 1-star reviews.

#### Jake (Demand-Side AI Developer, Austin TX)
- "Worker reachability score of 72/100 is noise dressed up as data." He can't see worker portfolios, can't ping workers, can't set auto-reminders, can't see activity logs.
- Worker submits blurry photos of wrong locations → no dispute process defined.
- "The entire spec reads like a supply-side document. I don't care if workers feel good using the app — I care if they complete my tasks accurately and on time."
- **Action:** Build a demand-side spec section before scaling supply. The Android app is worthless without paying customers on the other side.

#### VC Analyst (Series A Evaluation)
- K-factor math is completely missing. Referral model has perverse incentives — in a task-scarce marketplace, every new worker is competition, so the rational move is NOT to invite.
- "Priority matching for 7 days" as a referral reward has zero tail value. After week 1, you're back to competing with everyone you invited.
- Revenue model is a subsidy model with no subsidy budget. Worker LTV = $0 at 0% fees.
- Custodial wallet = money transmission = regulatory risk in every target market.
- **Verdict: PASS.** "Not because the idea fails — because this spec proves the team hasn't found their real business yet."

---

## Market Activation Thresholds (NEW — from persona testing)

Don't activate a market in the app until minimum task density exists. Workers who download and see an empty marketplace will uninstall AND leave 1-star reviews — destroying the Play Store ranking we're trying to build.

### Activation Criteria Per Market

| Metric | Minimum Threshold | Why |
|---|---|---|
| Available tasks per day | ≥ 5 per skill category | Workers need choice. 1-2 tasks/day feels dead. |
| Tasks in worker's language | ≥ 3 per day | Non-English workers in PH, VE, RU, IN need local-language tasks |
| Average time-to-match | < 6 hours | Priya waited 6+ hours and considered deleting. >6h feels abandoned. |
| Agent-side demand (monthly task volume) | ≥ 500 tasks/month in-country | Below this, marketplace is too thin for reliable fulfillment |

### Pre-Launch Strategy

```
1. Soft-launch with web-only in each market
2. Track task density metrics for 30 days
3. Only submit Play Store listing for markets that hit ALL thresholds
4. Markets below threshold: keep web-only, focus on demand-side acquisition first
5. Use Play Store Custom Listings to geo-target only activated markets
```

### "Coming Soon" Mode for Sub-Threshold Markets

If a worker in a sub-threshold market finds the app anyway:
```
"HumanPages isn't fully available in [country] yet.
We're onboarding employers in your region.

Want to be first when jobs arrive?
[Join the waitlist] → collects email + skills + country

We'll notify you when there are 5+ daily tasks matching your skills."
```

This is better than showing an empty marketplace. It sets expectations AND captures leads for when the market activates.

---

## Demand-Side Platform Requirements (NEW — from persona testing)

The Android app is supply-side only — agents interact via MCP, not the app. But the app's success depends entirely on demand-side volume flowing through the MCP. Jake (demand-side AI dev) pointed out that without these platform-level features, the supply side is worthless — workers download, see no tasks, and uninstall.

### The Problem

Agents access HumanPages through the MCP (Model Context Protocol). They don't need the Android app. But the Android app's value proposition (earn $2-5 per task) requires a steady flow of tasks from agents. If the MCP experience is clunky, agents post fewer tasks → workers see empty marketplace → workers churn → Play Store rating tanks.

### Required MCP + Platform Features (prerequisites for Android app success)

These are NOT Android features — they're MCP/backend features that MUST exist for the Android app to succeed:

#### 1. Worker Quality Signals (exposed via MCP)

Agents querying workers through MCP need to evaluate quality before assigning tasks:

```
Current via MCP: agent sees name + skills
Needed via MCP:
  - completion_rate: 0.92        // % of accepted tasks completed
  - quality_score: 4.3           // 1-5, agent-rated after each task
  - response_time_median: "14m"  // time from notification to acceptance
  - tasks_completed: 47          // total count
  - verified_skills: ["photo", "translation"]  // 5+ completed tasks in skill
```

#### 2. Task Lifecycle via MCP

Agents need programmatic control over the full task lifecycle, not just posting:

```
Current via MCP: create_task → wait → hope
Needed via MCP:
  - task.status: posted → matched → accepted → in_progress → submitted → reviewed
  - task.ping_worker(message)    // "Reminder: due in 2 hours"
  - task.reassign(reason)        // auto or manual reassign
  - task.batch_create([...])     // post 50 tasks at once
  - task.reject(reason)          // triggers worker notification + revision flow
  - task.approve_and_pay()       // releases escrow
```

#### 3. Dispute Resolution (platform-level, visible to workers via Android app)

```
Agent rejects submission via MCP → worker gets push notification with reason
Worker can revise and resubmit via Android app (1 revision allowed)
If still rejected → mediation queue (HumanPages team reviews)
Escrow: payment held until agent approves OR mediation resolves
Timeout: if agent doesn't review within 72h, auto-approve and pay worker
```

#### 4. Auto-Matching (MCP-driven, notifications via Android app)

```
Agent posts task via MCP → platform auto-matches top 3 qualified workers
→ FCM push to matched workers via Android app
→ First to accept gets the task
→ Agent sees assignment confirmation via MCP

Quality gate: workers below 80% completion rate excluded from auto-match
Premium tasks ($5+): require verified skills
Preferred workers: agent can save worker IDs for priority matching on future tasks
```

### Acceptance Criteria (Platform/MCP — prerequisite for Android V2+)

- [ ] MCP exposes worker quality signals (completion rate, quality score, response time)
- [ ] MCP supports full task lifecycle (create, status, ping, reassign, reject, approve)
- [ ] Rejection via MCP triggers push notification to worker with reason
- [ ] Workers can revise and resubmit rejected tasks via Android app
- [ ] Unreviewed submissions auto-approve and auto-pay after 72 hours
- [ ] Auto-matching selects top 3 workers and sends FCM notifications
- [ ] Escrow holds payment until agent approval or mediation resolution
- [ ] Batch task creation via MCP (≥50 tasks per call)

---

## Unit Economics Model (NEW — from persona testing)

The VC persona identified that the spec has no unit economics. This section defines the numbers that must work for the Android app to be a viable growth channel, not a cost center.

### Current Model (Broken)

```
Worker-side revenue:    $0 (0% fees)
Worker acquisition cost: $X (Play Store ads, referral rewards, WA API, infrastructure)
Worker LTV:             $0
Net:                    -$X per worker acquired
```

This only works if agent-side revenue exceeds total worker acquisition costs.

### Required Metrics to Track

| Metric | Target | Current | Status |
|---|---|---|---|
| Agent monthly spend (ARPPU) | $100+/month | Unknown | ⚠️ Must measure before scaling supply |
| Active agents (paying) | 50+ | Unknown | ⚠️ Must measure |
| Tasks per agent per month | 20+ | Unknown | ⚠️ Must measure |
| Agent-to-worker ratio | 1:10 minimum | Unknown | ⚠️ Determines marketplace density |
| Worker acquisition cost (CAC) | < $2 | Unknown | Track via Play Store + referral |
| Worker D30 retention | > 15% | Unknown | Industry benchmark is 8% |
| Tasks completed per active worker per month | 10+ | Unknown | Below this, worker churns |
| Revenue per task (platform take) | $0.50-1.00 | $0 | ⚠️ Must introduce platform fee or agent subscription |

### Revenue Model Options

**Option A: Agent subscription ($49-199/month)**
- Agents pay monthly for platform access + N tasks/month
- Workers stay at 0% fees (competitive advantage)
- Risk: agents won't pay until marketplace proves reliable

**Option B: Agent per-task fee (10-15%)**
- Agent posts $5 task → platform takes $0.50-0.75 → worker receives $4.25-4.50
- Workers still see "no fees" (fee is on agent side)
- Risk: agents compare to MTurk (20% fee) and expect more reliability

**Option C: Premium features (freemium)**
- Basic: free posting, manual matching, standard support
- Premium ($99/month): auto-matching, priority support, analytics dashboard, batch posting
- Risk: free tier must be good enough to attract agents, premium must be compelling enough to convert

**Recommendation:** Option B (per-task fee on agent side) combined with Option C (premium dashboard). This keeps the "zero fees for workers" value prop intact while generating revenue per transaction.

### Break-Even Math

**⚠️ IMPORTANT: These numbers are ASSUMPTIONS, not validated data. Senior review flagged this section as "faith-based." Every assumption below must be validated before scaling past V1.**

```
Assumptions (UNVALIDATED — must measure before V2):
  - 50 active agents spending $100/month average = $5,000/month revenue
  - 1,600 MAU workers (20K downloads × 8% retention)
  - Worker CAC: $1.50 (organic Play Store + referrals)
  - Monthly worker acquisition: 500 new workers
  - Monthly acquisition cost: $750

Revenue: $5,000/month
Costs:   $750 (acquisition) + $300 (WhatsApp API) + $200 (infrastructure) = $1,250/month
Margin:  $3,750/month

REALITY CHECK (from senior review):
  - "50 agents" has zero supporting evidence. How many paying MCP customers TODAY? Measure first.
  - $100/month ARPPU is optimistic. More realistic: $30-50/month unless premium features exist.
  - $1.50 CAC assumes referral K=0.72 (realistic K is ~0.16). Real CAC with paid ads: $2-5.
  - At realistic numbers: 20 agents × $50/mo = $1,000/mo revenue vs $1,500/mo costs = net LOSS.
  - The app is a SUBSIDY PLAY: betting agent demand scales 5-10x before CAC compounds.
  - This is a valid bet IF demand-side is the primary focus. Say it explicitly.
```

### Pre-Android Gate

**Do not invest in Android app growth (V2+) until:**
1. ≥ 20 active paying agents (validated demand)
2. ≥ 100 tasks/week posted organically (marketplace has volume)
3. Agent-side revenue ≥ $2,000/month (covers infrastructure + acquisition)

V1 (bare APK on Play Store) is fine as a low-cost credibility play. But V2-V4 growth features should be gated on demand-side validation.

---

## Referral Incentive Redesign (NEW — from persona testing)

The VC agent identified that the current referral model has perverse incentives. In a task-scarce marketplace, inviting more workers means more competition for the same jobs. The rational move is NOT to invite.

### Current Model (Broken)

```
Referrer reward: "Priority Worker" badge for 7 days
Referred reward: "Highlighted to agents" for 48h
Problem: Priority matching in a sparse marketplace = first pick of 3 jobs instead of second pick.
         Zero tail value after the badge expires.
         K-factor < 1 by design.
```

### Redesigned Model

```
Referrer reward: $0.50 USDC cash bonus when referred worker completes QUALIFICATION TEST
  - Funded from platform's agent-side revenue (cost of acquisition)
  - Triggers on qualification, not task completion — decouples from marketplace density
  - Qualification = 5-min test, so referrer gets paid within hours of referral, not days
  - Cap: 20 referral bonuses per month per worker ($10 max)

Referred reward: Profile highlighted to agents for 48h after qualification
  - No cash promise to the referred worker — avoids "where is my bonus" if tasks are sparse

Milestone bonuses (cash):
  - 5 qualified referrals: $5 bonus
  - 20 qualified referrals: $20 bonus + "Community Leader" badge (permanent)
  - 50 qualified referrals: $50 bonus + featured on leaderboard
```

### Why Qualification Trigger > Task Trigger

The original redesign tied the bonus to the referred worker's first task completion. The psychological analysis showed this is still dangerous:

1. **Referrer can't control task availability.** If they refer 5 friends and none can find tasks, the referrer sees "Pending: $2.50" and gets frustrated — even though it's a marketplace density problem, not a referral problem.
2. **"Pending" bonuses trigger entitlement.** Workers see money they can't access. This IS the "where is my money" pattern.
3. **Blame asymmetry.** Referrer blames the platform AND the friend ("why didn't you do a task?").

Qualification trigger solves all three:
- Referrer gets paid within hours (friend does a 5-min test)
- No "pending" state — it either happened or it didn't
- Referrer's reward is fully in their control (recruit someone, they qualify, done)

### Updated K-Factor Math

**Optimistic estimate (top 20% of workers):**
```
  - Engaged worker invites 3 friends
  - 40% install (WhatsApp link + social proof)
  - 60% of installers complete qualification
  - K = 3 × 0.40 × 0.60 = 0.72
```

**Realistic estimate (median worker — use this for planning):**
```
  - Median worker invites 0.5-1.0 friends (most workers don't share at all)
  - 40% install rate (WhatsApp links convert well in target markets)
  - 40% qualification rate (some install but never open, some fail the test)
  - K = 1.0 × 0.40 × 0.40 = 0.16
```

**What K = 0.16 means:** Referrals are a **retention/engagement tool**, not a viral growth engine. You'll get ~10-15% of new signups from referrals — meaningful but not exponential. Plan primary acquisition via: Play Store organic (ASO), paid ads ($200-500/month test budget), and community seeding in Filipino gig worker groups.

**When to revisit:** If actual K > 0.40 after 500+ referral data points, shift budget from paid to organic/referral. If K < 0.10, the $0.50 incentive isn't working — test higher amounts ($1-2) or different reward types.

---

## Cash-Out Flow E2E Testing (NEW — from persona testing)

Country-specific cash-out guides are not enough as documentation. They must be tested end-to-end with real money on real devices in each target market. A guide that says "Send to GCash via Coins.ph" is useless if Coins.ph changed their UI last month.

### Required E2E Tests Per Market

| Market | Exchange | Cash-Out Path | Test Frequency |
|---|---|---|---|
| 🇵🇭 Philippines | Coins.ph → GCash | USDC (Base) → Coins.ph → GCash → cash out at 7-Eleven | Monthly |
| 🇻🇪 Venezuela | Binance P2P | USDC (Tron) → Binance → P2P sell → Bolivar to bank | Monthly |
| 🇳🇬 Nigeria | Luno / Quidax | USDC → Luno → NGN → bank transfer | Monthly |
| 🇷🇺 Russia | Bybit P2P | USDC → Bybit → P2P sell → RUB to Sberbank/Tinkoff | Monthly |
| 🇮🇳 India | WazirX / CoinDCX | USDC → WazirX → INR → UPI transfer | Monthly |

### Cash-Out Guide Format

Each guide must include:
1. **Screenshot walkthrough** (actual screenshots from the exchange, updated monthly)
2. **Expected fees** at each step (exchange fee + withdrawal fee + gas fee)
3. **Expected time** (how long from "tap cash out" to money in bank)
4. **Minimum withdrawal** (some exchanges have minimums that exceed typical task earnings)
5. **Fallback option** (if primary exchange is down or unavailable)

### Acceptance Criteria

- [ ] Each target market has a tested cash-out guide with screenshots < 30 days old
- [ ] Each guide includes total fee breakdown (platform → exchange → bank)
- [ ] Each guide lists minimum withdrawal amount vs. typical task earnings
- [ ] Each guide has a fallback exchange option
- [ ] Guides are accessible in the app AND via WhatsApp link (for workers who prefer WA)
- [ ] Monthly automated reminder to test and update all guides

---

## Dev Team Review Checklist

### Architect
- [ ] Capacitor config correctly targets Android 10+ (API 29+)
- [ ] DeviceRegistration model has proper indexes and cascade deletes
- [ ] FCM and web push coexist without conflicts
- [ ] Offline cache doesn't grow unbounded (cap at 50 jobs, FIFO eviction)
- [ ] Reachability score computation is idempotent and eventually consistent
- [ ] No circular dependencies between capacitorBridge, capacitorPush, and existing push modules

### QA
- [ ] All acceptance criteria have corresponding test cases
- [ ] Offline mode tested: airplane mode, spotty connection, reconnect
- [ ] Push notification tested: app foreground, background, killed
- [ ] Deep links tested: from browser, from other apps, from notifications
- [ ] Back button tested: navigation stack, exit behavior
- [ ] Data saver mode tested: image quality, page sizes, auto-load disabled
- [ ] Cold start measured on budget device profile
- [ ] Battery drain measured over 1-hour active session

### Security
- [ ] No tokens in localStorage when running on native platform
- [ ] APK decompilation reveals no embedded secrets
- [ ] Notification payload validation rejects malicious data
- [ ] FCM token stored only in secure storage + backend DB
- [ ] Deep links reject non-humanpages.ai origins
- [ ] WebView file:// protocol disabled

### Backend
- [ ] POST /api/humans/device-status validates all fields (Zod schema)
- [ ] GET /api/humans/reachability/:humanId requires agent auth
- [ ] DeviceRegistration has per-user cap (max 10 devices, matching PushSubscription)
- [ ] FCM sending handles token expiry (delete stale registrations)
- [ ] Rate limiting on device-status endpoint (reasonable — called on app open)

### Frontend
- [ ] Platform detection works correctly in all environments (web, Android, dev server)
- [ ] Secure storage fallback works if plugin fails (graceful degradation to localStorage with warning)
- [ ] Offline banner appears/disappears correctly on network transitions
- [ ] Data saver toggle persists across app restarts
- [ ] No UI regressions on web (all Capacitor code gated behind `isNative()`)

### UX (Developing Markets Focus)
- [ ] App loads acceptably on 3G network simulation
- [ ] Offline mode is discoverable (not hidden in settings)
- [ ] Data saver mode is prominent in settings (not buried)
- [ ] Notification permission request explains WHY (job alerts, not spam)
- [ ] Error states are clear when offline and trying to apply

### Product Manager
- [ ] Play Store listing keywords target developing markets
- [ ] Play Store listing localized in 5 languages (EN, TL, ES, RU, HI) — not just translated, culturally adapted
- [ ] Screenshots localized per language (not English screenshots with translated text)
- [ ] Screenshots show job browsing, notification, USDC payment, referral card
- [ ] Privacy policy covers device data collection (FCM tokens, device model, referral tracking)
- [ ] Analytics events track: app_open, notification_received, notification_clicked, job_applied_offline, data_saver_toggled, referral_shared, referral_clicked, referral_installed, referral_completed, review_prompted, review_completed

### Growth Engineer
- [ ] Referral code generation is deterministic and collision-free
- [ ] Referral deep links survive the Play Store install flow (deferred deep linking)
- [ ] Share sheet shows correct preview (title, description, image) on WhatsApp/Telegram
- [ ] Referral rewards are idempotent (can't double-claim)
- [ ] Priority matching actually delays job visibility to non-priority workers by 5 min
- [ ] In-app review prompt timing follows Google's guidelines (not on first launch, after value moment)
- [ ] Review prompt respects Google's built-in quota (won't show broken UI if quota hit)
- [ ] Referral leaderboard queries are indexed and performant
- [ ] UTM tracking captures install source for attribution dashboard
