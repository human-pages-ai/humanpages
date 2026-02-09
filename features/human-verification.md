# Human Verification & Credibility

**Status:** Planned (Post-Launch)
**Priority:** Medium
**Motivation:** Agents need confidence that the humans they hire are real people with genuine skills.

---

## Overview

Email verification ensures a human has a working email, but it doesn't prove they're a real person, that their skills are genuine, or that their social profiles are actually theirs. This feature adds layered verification to help agents assess human credibility before sending offers.

---

## Design

### Verification Layers

| Layer | What It Proves | Effort | Trust Signal |
|-------|---------------|--------|-------------|
| Email verified | Has a working email | Low | Baseline (already exists) |
| Social verified | Owns claimed social accounts | Low | Moderate |
| Proof of humanity | Is a real, unique person | Medium | High |
| Skill evidence | Has demonstrated the claimed skill | Medium | High |
| Video intro | Real person, approachable | Medium | Very high |

### 1. Social Account Verification (OAuth)

Currently humans paste social URLs. There's no proof they own those accounts.

**Approach:** Add OAuth login for LinkedIn, GitHub, Twitter/X. When a human connects via OAuth, mark that social link as "verified".

```prisma
model Human {
  // ... existing fields

  linkedinVerified   Boolean @default(false)
  githubVerified     Boolean @default(false)
  twitterVerified    Boolean @default(false)
  googleVerified     Boolean @default(false)  // Already have Google OAuth
}
```

**Display:** Verified social links get a checkmark icon. Unverified links show as plain text.

**Implementation:**
- LinkedIn: OAuth 2.0 with `r_liteprofile` scope, match profile URL
- GitHub: OAuth, match username to `githubUrl`
- Twitter/X: OAuth 2.0 with PKCE, match handle
- On successful OAuth, set `*Verified = true` and update the URL if needed

### 2. Proof of Humanity

Integrate with one or more decentralized identity protocols to prove a human is a unique real person.

**Options:**

| Provider | Method | Cost | Privacy |
|----------|--------|------|---------|
| Worldcoin (World ID) | Iris scan (orb) or device verify | Free | ZK proof, no biometric stored |
| Gitcoin Passport | Score from multiple stamps (social, on-chain, etc.) | Free | Aggregated score |
| BrightID | Social graph verification | Free | Peer-verified |
| Proof of Humanity (PoH) | Video + vouch + deposit | ~$0.13 ETH | On-chain, public |

**Recommended first integration:** Gitcoin Passport (lowest friction, no hardware needed, score-based).

```prisma
model Human {
  // ... existing fields

  humanityVerified       Boolean  @default(false)
  humanityProvider       String?                    // "gitcoin_passport", "worldcoin", etc.
  humanityScore          Float?                     // Provider-specific score
  humanityVerifiedAt     DateTime?
}
```

**Display:** "Verified Human" badge on profile. Agents can filter search results by `humanityVerified = true`.

### 3. Skill Evidence

Let humans attach evidence to their claimed skills — portfolio items, certifications, or work samples.

```prisma
model SkillEvidence {
  id          String   @id @default(cuid())
  humanId     String
  skill       String                           // Must match one of human's skills[]
  type        EvidenceType
  title       String                           // "Wedding Photography Portfolio"
  url         String                           // Link to portfolio/cert/sample
  description String?
  createdAt   DateTime @default(now())

  human       Human @relation(fields: [humanId], references: [id], onDelete: Cascade)

  @@index([humanId])
  @@index([skill])
}

enum EvidenceType {
  PORTFOLIO        // Link to portfolio site or gallery
  CERTIFICATION    // Link to certification or credential
  WORK_SAMPLE      // Link to specific deliverable
  TESTIMONIAL      // Link to external review/testimonial
}
```

**Display:** Each skill on the profile shows evidence count. Clicking expands to show linked evidence items.

### 4. Video Introduction

Optional short video (30-60 seconds) where the human introduces themselves. Hard to fake, builds personal connection, helps agents assess communication ability.

**Implementation:**
- Human uploads video via dashboard (max 60s, max 50MB)
- Stored in S3/R2 (not in database)
- Transcoded to web-friendly format
- Displayed on public profile with play button

```prisma
model Human {
  // ... existing fields

  introVideoUrl    String?
  introVideoAt     DateTime?
}
```

**Moderation:** Flag videos that are auto-generated or contain inappropriate content. Initially manual review, later automated.

---

## API Changes

### Connect Social Account
```
GET /api/auth/linkedin/connect   → Redirects to LinkedIn OAuth
GET /api/auth/github/connect     → Redirects to GitHub OAuth
GET /api/auth/twitter/connect    → Redirects to Twitter OAuth

// Callback sets *Verified = true
GET /api/auth/:provider/callback?code=...
```

### Verify Humanity
```
POST /api/humans/me/verify-humanity
{
  "provider": "gitcoin_passport",
  "proof": { ... }                 // Provider-specific proof payload
}

Response:
{
  "humanityVerified": true,
  "humanityScore": 24.5,
  "humanityProvider": "gitcoin_passport"
}
```

### Add Skill Evidence
```
POST /api/humans/me/evidence
{
  "skill": "photography",
  "type": "PORTFOLIO",
  "title": "Wedding Photography Portfolio",
  "url": "https://example.com/portfolio"
}
```

### Upload Video Intro
```
POST /api/humans/me/intro-video
Content-Type: multipart/form-data
Body: video file (max 60s, max 50MB)

Response:
{
  "introVideoUrl": "https://cdn.humanpages.ai/videos/abc123.mp4"
}
```

---

## Search Integration

Agents can filter by verification level:

```
GET /api/humans/search?skill=photography&verified=social
GET /api/humans/search?skill=photography&verified=humanity
GET /api/humans/search?skill=photography&hasEvidence=true
GET /api/humans/search?skill=photography&hasVideo=true
```

MCP `search_humans` tool gets matching filter parameters.

---

## Frontend Changes

### Profile Verification Section
- [ ] "Verify your identity" card in dashboard with progress checklist
- [ ] OAuth connect buttons for social accounts (LinkedIn, GitHub, Twitter)
- [ ] "Verify Humanity" button linking to Gitcoin Passport flow
- [ ] Skill evidence management (add/remove per skill)
- [ ] Video upload with preview and re-record

### Public Profile
- [ ] Verification badges next to each social link (verified vs unverified)
- [ ] "Verified Human" badge with provider info
- [ ] Skill evidence expandable sections
- [ ] Video intro player (thumbnail + play button)

### Trust Score Display
- [ ] Composite "trust level" indicator: Bronze (email only) → Silver (social verified) → Gold (humanity + evidence) → Platinum (all + video + reputation)
- [ ] Shown in search results and profile header

---

## Implementation Phases

### Phase 1: Social OAuth Verification
- [ ] LinkedIn OAuth integration
- [ ] GitHub OAuth integration
- [ ] Twitter/X OAuth integration
- [ ] Verified badge display on profile

### Phase 2: Skill Evidence
- [ ] SkillEvidence model and CRUD endpoints
- [ ] Evidence display on public profile
- [ ] Search filtering by evidence availability

### Phase 3: Proof of Humanity
- [ ] Gitcoin Passport integration (or chosen provider)
- [ ] Verification flow and badge
- [ ] Search filtering by humanity verification

### Phase 4: Video Introduction
- [ ] Video upload endpoint with size/duration validation
- [ ] Storage integration (S3/R2)
- [ ] Video player on public profile
- [ ] Basic moderation tooling

---

## Privacy Considerations

- Social OAuth only requests minimal scopes (profile URL, not posts/connections)
- Humanity proofs use ZK or score-based approaches (no biometric storage)
- Video intros are opt-in and can be deleted at any time
- All verification data included in data export
- All verification data deleted on account deletion

---

## Open Questions

1. **Which humanity provider first?** Gitcoin Passport is lowest friction but less rigorous than Worldcoin.
2. **Should verified humans rank higher in search?** Or just display badges and let agents decide?
3. **Video moderation at scale?** Manual works early, but need automated solution eventually.
4. **Should evidence be agent-visible only?** Or fully public?
5. **Trust score formula?** How to weight each verification layer?
