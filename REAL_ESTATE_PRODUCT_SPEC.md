# HumanPages Real Estate Integration Spec
## Roadmap to 9+/10 VP Score

**Current Score:** 5/10
**Target Score:** 9+/10
**User:** VP of Innovation at major real estate company
**Timeline:** 16 weeks (MVP to 8/10), 24 weeks (full 9+/10)

---

## EXECUTIVE SUMMARY

HumanPages must evolve from P2P contractor marketplace to **enterprise-grade contractor management platform** trusted by real estate brokers for on-site service delivery. The 4-point gap (5→9) requires:

1. **Escrow + Dispute Resolution** (2 weeks) — closes liability/payment risk
2. **Contractor Licensing Verification** (3 weeks) — closes credentialing gap
3. **Background Checks + E&O Insurance** (4 weeks) — closes insurance/indemnification gap
4. **MLS/CRM Integration** (4 weeks) — closes workflow/data privacy gap
5. **Geofencing + Photo Validation** (3 weeks) — closes proof-of-work gap
6. **SLA/Uptime Guarantees** (2 weeks) — closes reliability gap
7. **Contractor Classification (W-2/1099 Handling)** (2 weeks) — closes compliance gap

---

## FEATURE 1: ESCROW + MOLTCOURT DISPUTE RESOLUTION

### 1.1 What It Closes
- **Payment Risk:** Funds held on-chain, never at risk of broker abandonment
- **Dispute Resolution:** AI-adjudicated splits (not all-or-nothing)
- **Liability Reduction:** Platform doesn't hold funds, contract is source of truth
- **Score Impact:** +1.5 points (moves from "no payment protection" → "enterprise-grade escrow")

### 1.2 Technical Implementation

**Smart Contract (Solidity)**
- Chain: Base L2 (low fees: $0.02-0.05 per transaction)
- Token: USDC only (immutable address)
- Functions: `deposit()`, `release()`, `proposeCancel()`, `acceptCancel()`, `dispute()`, `resolve()`, `timeoutWithdraw()`
- Safety: ReentrancyGuard, Pausable, Arbitrator whitelist (approved signers only)
- Limits: $5-$500 deposit range (configurable)

**Database Schema (Prisma)**
```prisma
enum EscrowStatus {
  PENDING_DEPOSIT
  DEPOSITED
  RELEASED
  CANCELLED
  DISPUTED
  RESOLVED
  TIMED_OUT
}

// Add to Job model:
escrowStatus                EscrowStatus?
escrowContractAddress       String?
escrowJobIdHash             String?
escrowDepositTxHash         String?      @unique
escrowDepositorAddress      String?
escrowPayeeAddress          String?
escrowDisputeTxHash         String?      @unique
escrowDisputedAt            DateTime?
escrowMoltCourtCaseId       String?
escrowVerdictAmountPayee    Decimal?     @db.Decimal(18, 6)
escrowVerdictAmountDepositor Decimal?    @db.Decimal(18, 6)
escrowResolveTxHash         String?      @unique
escrowResolvedAt            DateTime?
escrowTimeoutAt             DateTime?

// Add to Agent model (reputation tracking):
escrowReleaseCount          Int @default(0)
escrowDisputeCount          Int @default(0)
escrowTimeoutCount          Int @default(0)  // agent abandonment metric
```

**API Endpoints**
```
POST   /api/escrow/:jobId/deposit          [Agent] Verify on-chain deposit, mark job PAID
POST   /api/escrow/:jobId/release          [Agent] Release funds to human
POST   /api/escrow/:jobId/propose-cancel   [Agent] Propose split (70/30)
POST   /api/escrow/:jobId/accept-cancel    [Human] Accept split
POST   /api/escrow/:jobId/dispute          [Either] Raise dispute → MoltCourt case
POST   /api/escrow/:jobId/resolve          [Either] Relay MoltCourt verdict on-chain
POST   /api/escrow/:jobId/timeout          [Either] Withdraw after 30-day timeout
GET    /api/escrow/:jobId/status           [Public] Live escrow state
POST   /api/escrow/webhook/moltcourt       [HMAC] MoltCourt verdict delivery
```

**MCP Tools**
- `escrow_deposit(jobId: string, txHash: string)` → Verify and record deposit
- `escrow_release(jobId: string, txHash: string)` → Release funds
- `escrow_dispute(jobId: string, txHash: string, reason: string)` → Start dispute

**Blockchain Service Layer** (`backend/src/lib/blockchain/escrow.ts`)
- `verifyEscrowDeposit(network, jobId, txHash)` → Reads on-chain state, validates amount/payee
- `getEscrowState(network, jobId)` → Current state from contract
- `getEscrowEIP712Domain(network)` → For signature verification

**MoltCourt Integration** (`backend/src/lib/blockchain/moltcourt.ts`)
- `createMoltCourtCase(jobDetails, disputeReason, partyAddresses)` → POST to MoltCourt API
- Receives verdict via webhook: `{jobId, amountPayee, amountDepositor, nonce, signature}`
- Backend relays verdict on-chain using relayer wallet (minimal ETH balance)

### 1.3 Effort Estimate
- Smart contract development + tests: 5 days
- Backend blockchain service: 3 days
- API endpoints + middleware: 3 days
- MoltCourt webhook integration: 2 days
- Database migration: 1 day
- **Total: 14 days (2 weeks)**

### 1.4 Dependencies
- Requires Base mainnet USDC deployment
- Requires MoltCourt API availability
- Requires relayer wallet setup (AWS KMS or encrypted keystore)

### 1.5 Go-Live Criteria
- Escrow contract audited by third-party security firm
- 100% test coverage (15 test cases from feature doc)
- Base Sepolia testnet smoke tests pass
- MoltCourt webhook integration tested end-to-end
- Relayer wallet funded with $10 ETH (covers ~1000 verdict relays)

---

## FEATURE 2: CONTRACTOR LICENSING VERIFICATION

### 2.1 What It Closes
- **Credentialing Gap:** Brokers can't verify contractors are licensed
- **Compliance Risk:** Real estate services require state licenses (HVAC, plumbing, electrical)
- **Enterprise Trust:** VP needs proof that platform vets contractor credentials
- **Score Impact:** +1.2 points (moves from "no credentialing" → "verified license database")

### 2.2 Technical Implementation

**License Type Enum (Profile Schema)**
```json
"LicenseType": [
  "RE_AGENT",
  "HVAC_TECHNICIAN",
  "PLUMBER",
  "ELECTRICIAN",
  "GENERAL_CONTRACTOR",
  "HOME_INSPECTOR",
  "APPRAISER",
  "PEST_CONTROL",
  "ROOFING",
  "LANDSCAPING"
]
```

**Database Schema**
```prisma
model ContractorLicense {
  id            String   @id @default(cuid())
  humanId       String
  licenseType   String   // enum value from above
  licenseNumber String
  state         String   // state of issue (e.g., "CA", "TX")
  issuedAt      DateTime
  expiresAt     DateTime
  verifiedAt    DateTime?
  verificationStatus String @default("PENDING")  // PENDING | VERIFIED | EXPIRED | INVALID
  verificationMethod String? // "state_board_api" | "manual_review" | "3rdparty_service"
  verificationError String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  human         Human    @relation(fields: [humanId], references: [id], onDelete: Cascade)

  @@unique([humanId, licenseType, licenseNumber, state])
  @@index([licenseType, state])
  @@index([verificationStatus])
  @@index([expiresAt])
}

// Add to Human model:
model Human {
  // ... existing fields
  contractorLicenses ContractorLicense[]
  licensesVerifiedAt DateTime?  // Cache: last verification batch timestamp
}
```

**Third-Party License Verification Service**

Option A: Directly integrate state licensing boards (CA Contractors State License Board API)
- Pro: Real-time, authoritative
- Con: Different APIs per state, high maintenance
- Cost: Free (state provided)

Option B: LexisNexis Verification Service (commercial)
- Pro: Unified API for 50+ states, high accuracy
- Con: $0.50-2.00 per lookup
- Cost: ~$500/month for typical brokerage (1000 lookups)

Option C: Hybrid (recommend)
- Use LexisNexis for initial verification
- Cache results with 90-day TTL
- Manual review path for disputes
- Cost: ~$300/month

**API Endpoints**
```
POST   /api/licenses/:type/verify          [Human] Submit license for verification
       Body: { licenseNumber, state, issuedDate?, expiresDate? }
       → Calls LexisNexis API, stores result

GET    /api/licenses/types                 [Public] List available license types

GET    /api/humans/:id/licenses            [Public] Show verified licenses on profile

POST   /api/licenses/:id/manual-review     [Admin] Flag for manual verification

PATCH  /api/licenses/:id/status            [Admin] Manual verification override
       Body: { status: "VERIFIED" | "INVALID", reason? }

GET    /api/admin/licenses/pending         [Admin] Batch verification dashboard
```

**Verification Flow (Frontend)**
1. Human selects license type during onboarding (new wizard step)
2. Provides license number, state, expiration date
3. Backend calls LexisNexis API (async, non-blocking)
4. Result cached: VERIFIED, EXPIRED, or INVALID
5. Frontend shows badge on profile: "Licensed HVAC Technician (CA)" with expiration
6. Profile shows "Verified by LexisNexis" with lookup timestamp

**Public Display (Profile Page)**
```
Licenses & Credentials
├─ Licensed HVAC Technician (CA) — Verified Jun 2024, expires Jun 2027
├─ CPR Certification — Verified Apr 2025
└─ General Contractor License (CA) — Verified Nov 2024, expires Nov 2025

[Verification badge]
```

**Agent Search Filter**
```
GET /api/humans/search?license_type=ELECTRICIAN&state=CA

→ Returns only humans with verified electrician licenses in CA
```

### 2.3 Effort Estimate
- LexisNexis API integration: 4 days
- Prisma migration + cache layer: 2 days
- API endpoints + verification logic: 3 days
- Frontend onboarding step + profile badges: 2 days
- Admin dashboard (batch verification): 2 days
- **Total: 13 days (just under 2 weeks, assume 3 weeks with review)**

### 2.4 Dependencies
- LexisNexis account + API key (or select alternative)
- Verification service API documentation
- State licensing data (mappings for each state)

---

## FEATURE 3: BACKGROUND CHECKS + E&O INSURANCE

### 3.1 What It Closes
- **Insurance Gap:** Brokers lack E&O coverage for unlicensed/unvetted contractors
- **Data Privacy:** Can't send closing docs to unverified workers
- **Liability:** "No insurance excludes unlicensed third parties" — this proves coverage
- **Enterprise Trust:** Insurance certificate displayed on profile
- **Score Impact:** +1.5 points (enterprise liability protection)

### 3.2 Technical Implementation

**Background Check Integration (Checkr or Stripe Identity)**

Recommended: **Checkr** (real estate & contractor-focused)
- API provides: SSN verification, criminal background, sex offender registry
- Cost: $20-30 per check
- Real-time results (10-30 min) or 1-2 business days
- Webhook notifications when check completes

**Database Schema**
```prisma
enum BackgroundCheckStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  EXPIRED
  FAILED
}

model BackgroundCheck {
  id               String   @id @default(cuid())
  humanId          String
  checkrCandidateId String?  // Checkr's internal ID
  status           BackgroundCheckStatus @default(PENDING)
  resultsJson      Json?    // Checkr full response

  // Key fields extracted from results:
  ssn_verified     Boolean?
  ssn_last4        String?
  criminal_record  Boolean?
  sex_offender     Boolean?

  requestedAt      DateTime @default(now())
  completedAt      DateTime?
  expiresAt        DateTime // 1 year from completion

  human            Human    @relation(fields: [humanId], references: [id], onDelete: Cascade)

  @@unique([humanId])
  @@index([status])
  @@index([expiresAt])
}

// Add to Human model:
backgroundCheck  BackgroundCheck?
backgroundCheckVerifiedAt DateTime?
```

**E&O Insurance Certificate Management**

Real estate agencies need errors & omissions coverage that extends to contractors. HumanPages can partner with an insurance provider (e.g., Stride Health, The Hartford) to offer:

1. **Certificate Issuance:** Once background check passes, broker can purchase contractor E&O add-on ($50-100/contractor/year)
2. **Certificate Storage:** PDF stored in R2, linked to contractor profile
3. **Verification:** Broker can verify certificate with insurer (reference number)

**Database Schema**
```prisma
model InsuranceCertificate {
  id                 String   @id @default(cuid())
  humanId            String
  brokerAgentId      String  // Agent who purchased coverage
  certificateNumber  String  @unique
  providerName       String  // "The Hartford", "Stride", etc.
  policyType         String  // "E&O_CONTRACTORS"
  issuedAt           DateTime
  expiresAt          DateTime
  certificateUrl     String  // R2 signed URL
  verificationCode   String  // For broker to verify with insurer
  brokerVerifiedAt   DateTime?

  human              Human    @relation(fields: [humanId], references: [id], onDelete: Cascade)
  agent              Agent    @relation(fields: [brokerAgentId], references: [id])

  @@index([humanId])
  @@index([brokerAgentId])
  @@index([expiresAt])
}

// Add to Agent model:
insuranceCertificates InsuranceCertificate[]
```

**API Endpoints**
```
POST   /api/background-check/:humanId/request  [Admin] Submit check to Checkr
       → Calls Checkr API, stores candidateId, webhook subscribed

POST   /api/background-check/webhook/checkr    [HMAC] Checkr notifies completion
       → Update status, extract criminal/SSN/etc., notify human + agent

GET    /api/humans/:id/background-check        [Public] Show check status & expiry
       → Returns: { status, completedAt, expiresAt }

GET    /api/agents/:id/contractors-covered     [Agent] List contractors with active E&O

POST   /api/insurance/purchase/:contractorId   [Agent] Buy E&O coverage
       Body: { policyType: "E&O_CONTRACTORS" }
       → Calls insurance partner API, generates certificate

GET    /api/insurance/certificate/:id          [Public] Download certificate

POST   /api/insurance/verify/:code             [External] Verify certificate with insurer
```

**Wizard Integration**

New step in onboarding: "Background Check & Insurance"
1. Request background check (no cost to contractor)
2. Once passes: broker can opt to purchase E&O coverage ($50/year)
3. Certificate appears on profile: "E&O Insured by The Hartford (Expires Dec 2025)"

**Profile Display**
```
Trust & Insurance
├─ Background Check: ✓ Verified (Feb 2025)
├─ E&O Insurance: ✓ Active (The Hartford, expires Feb 2026)
├─ Licensed: ✓ HVAC Technician (CA)
└─ Verification Score: 95/100
```

### 3.3 Effort Estimate
- Checkr API integration: 3 days
- Insurance partner API integration: 4 days
- Webhook handlers + certificate generation: 2 days
- Frontend wizard step + profile display: 2 days
- Database migration: 1 day
- **Total: 12 days (2 weeks, assume 4 weeks with insurance partner delays)**

### 3.4 Dependencies
- Checkr API account + webhook setup
- Insurance partner agreement (The Hartford, Stride, etc.)
- Legal review: insurance product compliance, liability clauses
- Compliance: FCRA compliance for background checks (disclosures, opt-out)

---

## FEATURE 4: MLS/CRM INTEGRATION (ZILLOW, FOLLOW UP BOSS, BRIVITY, DOCUSIGN)

### 4.1 What It Closes
- **Workflow Integration:** Brokers can't send jobs directly from MLS/CRM
- **Data Privacy:** Can't auto-redact sensitive docs before sending
- **Compliance:** No tracking of who accessed what documents
- **Enterprise Adoption:** Seamless workflow = higher adoption
- **Score Impact:** +1.3 points (moves from "standalone tool" → "integrated platform")

### 4.2 Technical Implementation

**OAuth2 Integrations (4 platforms)**

Each platform requires OAuth2 setup:

| Platform | API Scope | Use Case |
|----------|-----------|----------|
| **Zillow (ZAPI)** | Property search, agent portal | Pull property details, create job pre-populated with address |
| **Follow Up Boss** | Contact management, pipeline | Create contact for contractor, log job completion |
| **Brivity** | Transaction management, closing docs | Send docs to contractor, track signature |
| **DocuSign** | E-signature, document tracking | Collect contractor signatures on liability waivers |

**Database Schema**
```prisma
model PlatformIntegration {
  id              String   @id @default(cuid())
  agentId         String
  platform        String   // "ZILLOW" | "FOLLOWUPBOSS" | "BRIVITY" | "DOCUSIGN"
  oauthTokenId    String   // Reference to encrypted token storage
  expiresAt       DateTime
  isActive        Boolean  @default(true)
  lastSyncAt      DateTime?

  agent           Agent    @relation(fields: [agentId], references: [id])

  @@unique([agentId, platform])
  @@index([platform, isActive])
}

// Add to Job model:
sourceIntegration String?  // "ZILLOW" | "FOLLOWUPBOSS" | null if manual
sourcePlatformPropertyId String?  // Zillow property ID
sourcePlatformContactId  String?  // FUB contact ID
docusignEnvelopeId      String?  // DocuSign envelope tracking
```

**API Endpoints**
```
// OAuth2 callback handlers
GET    /api/integrations/:platform/auth       Redirects to platform OAuth consent
GET    /api/integrations/:platform/callback   OAuth2 callback, stores encrypted token

// Job creation from platform
POST   /api/integrations/zillow/create-job    [Agent] Create job from Zillow property
       Body: { zillow_property_id, skills_needed, budget }
       → Fetches property details, pre-fills job form

POST   /api/integrations/followupboss/sync-contact  [Agent] Sync contractor to FUB
       Body: { humanId, agentId }
       → Creates contact in FUB pipeline

// Document management
POST   /api/integrations/brivity/send-docs    [Agent] Send closing docs to contractor
       Body: { jobId, docIds: [array], redact_sections: [PII] }
       → Pulls docs from Brivity, strips PII, sends to contractor, logs access

POST   /api/integrations/docusign/request-signature  [Agent] Request contractor signature
       Body: { jobId, documentUrl, signatureFields: [name, date, initials] }
       → Creates DocuSign envelope, webhooks for completion

// Sync status
GET    /api/integrations/:agentId/status      [Agent] View integration status & last sync

PATCH  /api/integrations/:platform/sync       [Agent] Force re-sync
```

**Document Redaction Service** (`backend/src/lib/docRedaction.ts`)

When broker sends closing docs to contractor, automatically redact:
- Seller's SSN, phone, email
- Buyer's financial info
- Commission splits
- Negotiated terms

```typescript
// Example: redact closing statement before sending
async function redactClosingDocs(docUrl: string, sections: string[]): Promise<string> {
  // Fetch doc from S3/Brivity
  const pdf = await fetchDocument(docUrl);

  // Redact sensitive fields
  for (const section of sections) {
    if (section === 'SSN') pdf.redactPattern(/\d{3}-\d{2}-\d{4}/g);
    if (section === 'FINANCIAL') pdf.redactPattern(/\$[\d,]+/g);
    if (section === 'SELLER_PII') pdf.redactNames(SELLER_NAMES);
  }

  // Upload to R2, return signed URL
  return await uploadRedactedPdf(pdf, `redacted/${jobId}`);
}
```

**Data Privacy & Compliance**

- **FCRA Compliance:** No contractor SSN stored in HP db (stays in external platform)
- **Document Access Logging:** Every doc view logged with timestamp, user, IP
- **PII Redaction:** Automatic on sensitive docs before contractor sees
- **Data Retention:** Docs auto-deleted after 90 days (configurable per agent)

**Webhook Handlers**

```typescript
// Brivity: When doc is accessed by contractor
POST /api/integrations/brivity/webhook/doc-access
{
  "jobId": "...",
  "contractorId": "...",
  "documentName": "Closing Statement.pdf",
  "accessedAt": "2026-03-29T14:32:00Z"
}
→ Log access, notify agent, compliance audit trail

// DocuSign: When contractor signs
POST /api/integrations/docusign/webhook/signature-complete
{
  "envelopeId": "...",
  "jobId": "...",
  "signatureTime": "2026-03-29T14:35:00Z"
}
→ Mark job as signed, notify agent
```

**Frontend UI (Job Creation)**

When agent creates a job:
1. Select source platform (Zillow, manual, etc.)
2. If Zillow: pre-fill property address, buyer name, closing date
3. Select contractor from HP network or invite new
4. Attach closing docs (auto-redacted based on contractor role)
5. Set liability waiver (auto-filled from DocuSign template)
6. Job creation complete

**Broker Dashboard Integration**

Agents see one unified dashboard showing:
- Recent jobs from all platforms
- Contractor status (pending/completed)
- Document access logs
- Signature status (DocuSign)

### 4.3 Effort Estimate
- Zillow OAuth + property API: 5 days
- Follow Up Boss OAuth + contact sync: 4 days
- Brivity OAuth + doc management: 5 days
- DocuSign OAuth + e-signature integration: 4 days
- Document redaction service: 3 days
- API endpoints + webhook handlers: 3 days
- Frontend integration (job creation flow): 3 days
- **Total: 27 days (4 weeks, realistically)**

### 4.4 Dependencies
- OAuth apps registered with all 4 platforms
- API documentation + sandbox access
- Legal review for PII redaction & data handling

---

## FEATURE 5: GEOFENCING + PHOTO VALIDATION

### 5.1 What It Closes
- **Proof of Work:** Can't verify contractor actually showed up
- **Structured Submission:** Can't auto-validate job completion (photo count/quality)
- **Fraud Prevention:** No check that job was done at correct location
- **Score Impact:** +0.8 points (anti-fraud, proof-of-work)

### 5.2 Technical Implementation

**Geofencing (Location Verification)**

```prisma
// Add to Job model:
geofenceCenterLat   Float?
geofenceCenterLng   Float?
geofenceRadiusM     Int @default(50)  // 50-meter radius default
geofenceVerifiedAt  DateTime?
```

**Photo Validation Service** (`backend/src/lib/photoValidation.ts`)

Checklist before accepting job submission:
- Minimum 3 photos (configurable per job type)
- Each photo taken within geofence (GPS metadata)
- Each photo within 2 hours of job completion time
- No duplicate images (hash comparison)
- Image quality: minimum 2MP resolution, not blurry

```typescript
interface PhotoValidation {
  isValid: boolean;
  errors: string[];
  details: {
    photoCount: number;
    allInGeofence: boolean;
    minResolution: number;
    noDuplicates: boolean;
    timestamps: string[];
  }
}

async function validateJobSubmission(jobId: string, photoUrls: string[]): Promise<PhotoValidation> {
  const job = await getJob(jobId);
  const results = [];

  // Check count
  if (photoUrls.length < 3) {
    return { isValid: false, errors: ['Minimum 3 photos required'] };
  }

  // Check each photo
  for (const url of photoUrls) {
    const photo = await analyzePhoto(url);

    // Check GPS geofence
    const inGeofence = calculateDistance(
      { lat: photo.gpsLat, lng: photo.gpsLng },
      { lat: job.geofenceCenterLat, lng: job.geofenceCenterLng }
    ) <= job.geofenceRadiusM;

    // Check timestamp within 2 hours of job end
    const withinTimeframe = Math.abs(
      new Date(photo.timestamp).getTime() - new Date(job.completedAt).getTime()
    ) < 2 * 60 * 60 * 1000;

    // Check resolution
    const highQuality = photo.width * photo.height >= 2_000_000;

    results.push({ inGeofence, withinTimeframe, highQuality });
  }

  // Check for duplicates
  const hashes = photoUrls.map(url => hashPhoto(url));
  const duplicates = new Set(hashes).size < hashes.length;

  return {
    isValid: results.every(r => r.inGeofence && r.withinTimeframe && r.highQuality) && !duplicates,
    errors: [
      ...results.filter(r => !r.inGeofence).map(() => 'Photo outside work location'),
      ...results.filter(r => !r.withinTimeframe).map(() => 'Photo timestamp outside 2-hour window'),
      ...results.filter(r => !r.highQuality).map(() => 'Photo resolution too low'),
      ...(duplicates ? ['Duplicate photos detected'] : [])
    ],
    details: {
      photoCount: photoUrls.length,
      allInGeofence: results.every(r => r.inGeofence),
      minResolution: Math.min(...photoUrls.map(u => getResolution(u))),
      noDuplicates: !duplicates,
      timestamps: photoUrls.map(u => getPhotoTimestamp(u))
    }
  };
}
```

**API Endpoints**
```
POST   /api/jobs/:jobId/submit-photos       [Human] Submit completion photos
       Body: { photoUrls: [array], completedAt: datetime }
       → Validates geofence + metadata, returns validation report

GET    /api/jobs/:jobId/submission-status   [Either] View validation status

POST   /api/jobs/:jobId/approve-submission  [Agent] Approve photos (skips validation)
       → For jobs where validation unnecessary (indoor, etc.)
```

**Frontend Photo Upload**

1. Job shows: "Submit 3+ photos from the work location to complete"
2. Contractor uploads photos via camera app (preserves GPS metadata)
3. Real-time validation: "✓ Photo 1 valid (GPS verified)", "✗ Photo 2 outside location"
4. Once valid, shows summary: "3 photos taken at correct location, 2:15 PM - 3:45 PM"
5. Agent reviews + approves or requests re-submission

**Configuration per Job Type**

```json
{
  "jobType": "home_inspection",
  "photoRequirements": {
    "minCount": 5,
    "geofenceRadiusM": 100,
    "timeframeHours": 4,
    "minResolutionMp": 3,
    "requiredAreas": ["exterior", "bedroom", "kitchen"]  // optional categorization
  }
}
```

### 5.3 Effort Estimate
- Geofencing + GPS verification logic: 2 days
- Photo metadata extraction + analysis: 3 days
- API endpoints + validation: 2 days
- Frontend upload UI: 2 days
- **Total: 9 days (1.3 weeks, round to 2 weeks)**

### 5.4 Dependencies
- Mobile app with camera access (already exists, needs permission enhancement)
- GPS metadata preservation (iOS/Android native camera)
- Photo hashing library (pHash or similar for duplicate detection)

---

## FEATURE 6: SLA/UPTIME GUARANTEES FOR CONTRACTORS

### 6.1 What It Closes
- **Reliability:** Brokers need guaranteed contractor availability
- **SLA Penalties:** Poor responders should be deprioritized
- **Scoring:** VPs expect "95% accept rate" type commitments
- **Score Impact:** +0.6 points (commitment + reliability metrics)

### 6.2 Technical Implementation

**SLA Metrics on Contractor Profile**

```prisma
model ContractorSLA {
  id                      String   @id @default(cuid())
  humanId                 String   @unique

  // Response time commitments
  responseTimeTarget      Int @default(3600)  // seconds (default: 1 hour)
  responseTimeMetPct      Int @default(90)    // % of jobs met target (90-100)

  // Acceptance rate
  offerAcceptanceRate     Int @default(80)    // % of offers accepted
  minimumAcceptanceRate   Int @default(70)    // SLA minimum

  // Completion rate
  jobCompletionRate       Int @default(95)    // % of accepted jobs completed
  minimumCompletionRate   Int @default(85)    // SLA minimum

  // Cancellation penalties
  recentCancellations     Int @default(0)     // Jobs cancelled in last 30 days
  maxCancellationsAllowed Int @default(2)     // SLA limit per month

  // Uptime windows
  weeklyAvailableHours    Int?                // Hours committed per week

  slaStatus               String @default("ACTIVE")  // ACTIVE | FLAGGED | SUSPENDED
  slaReviewedAt           DateTime?

  human                   Human @relation(fields: [humanId], references: [id])

  @@index([responseTimeMetPct])
  @@index([slaStatus])
}

// Add to Job model:
respondedAt             DateTime?  // When contractor first saw offer
responseTimeMinutes     Int?       // Time from sent to response
acceptanceOnTime        Boolean?   // Met SLA deadline
```

**SLA Tier System**

```json
{
  "sla_tiers": {
    "STANDARD": {
      "responseTimeTarget": 3600,      // 1 hour
      "minimumAcceptanceRate": 70,
      "minimumCompletionRate": 85,
      "cancellationsPerMonth": 2,
      "monthlyMinimumJobs": 0          // No minimum
    },
    "PREMIUM": {
      "responseTimeTarget": 1800,      // 30 minutes
      "minimumAcceptanceRate": 85,
      "minimumCompletionRate": 95,
      "cancellationsPerMonth": 1,
      "monthlyMinimumJobs": 10         // Commit to at least 10 jobs/month
    },
    "ENTERPRISE": {
      "responseTimeTarget": 900,       // 15 minutes
      "minimumAcceptanceRate": 95,
      "minimumCompletionRate": 99,
      "cancellationsPerMonth": 0,
      "monthlyMinimumJobs": 20         // 20+ jobs/month
    }
  }
}
```

**SLA Monitoring & Penalties**

Nightly cron job evaluates:
```typescript
async function evaluateContractorSLA(humanId: string) {
  const sla = await getSLA(humanId);
  const last30Days = getJobsInWindow(humanId, 30);

  // Calculate metrics
  const responseTimeMetPct = calculateResponseTimeMet(last30Days);
  const acceptanceRate = last30Days.accepted / last30Days.total;
  const completionRate = last30Days.completed / last30Days.accepted;
  const recentCancellations = last30Days.filter(j => j.cancelled).length;

  // Check compliance
  const violations = [];
  if (responseTimeMetPct < sla.minimumResponseTimePct) violations.push('response_time');
  if (acceptanceRate < sla.minimumAcceptanceRate) violations.push('acceptance_rate');
  if (completionRate < sla.minimumCompletionRate) violations.push('completion_rate');
  if (recentCancellations > sla.maxCancellationsAllowed) violations.push('cancellations');

  // Actions
  if (violations.length > 0) {
    sla.slaStatus = 'FLAGGED';
    // Deprioritize in search results
    // Send warning email
  } else {
    sla.slaStatus = 'ACTIVE';
  }

  // Suspension after 3 warnings
  if (sla.violations >= 3) {
    sla.slaStatus = 'SUSPENDED';
    // Remove from search results entirely
  }
}
```

**API Endpoints**
```
GET    /api/humans/:id/sla                [Public] View contractor SLA status
       → Returns: { tier, responseTimeTarget, acceptanceRate, completionRate, status }

PATCH  /api/humans/:id/sla-tier           [Human] Upgrade to Premium/Enterprise
       Body: { tier: "PREMIUM" }
       → Auto-enables higher commitment, shows badge on profile

GET    /api/admin/sla-violations          [Admin] Dashboard of flagged contractors

POST   /api/admin/sla/:humanId/suspend    [Admin] Suspend contractor for SLA breach
```

**Public Profile Display**
```
Contractor Reliability
├─ Response Time SLA: 1 hour (90% met)
├─ Acceptance Rate: 92%
├─ Completion Rate: 97%
├─ SLA Tier: PREMIUM
└─ Status: ✓ ACTIVE
```

### 6.3 Effort Estimate
- SLA data model + migration: 1 day
- Nightly evaluation cron job: 2 days
- API endpoints: 1 day
- Frontend profile display: 1 day
- **Total: 5 days (1 week, round to 2 weeks with review)**

---

## FEATURE 7: CONTRACTOR CLASSIFICATION (W-2 VS 1099 HANDLING)

### 7.1 What It Closes
- **Tax Compliance:** Brokers must prove W-2 workers don't pose 1099 misclassification risk
- **Legal Liability:** Regulatory compliance (IRS, state labor boards)
- **Classification Flags:** Mark contractors as "cleared for W-2" or "independent only"
- **Score Impact:** +0.7 points (compliance + legal clarity)

### 7.2 Technical Implementation

**Classification Enum**
```prisma
enum EmploymentStatus {
  INDEPENDENT        // 1099 only
  EMPLOYED           // Can be W-2 (for a specific agent)
  BOTH               // Flexible
  UNKNOWN            // Not specified
}

model ContractorClassification {
  id                String   @id @default(cuid())
  humanId           String   @unique

  employmentStatus  EmploymentStatus @default(INDEPENDENT)

  // For agents hiring this contractor as W-2
  w2EligibleFor     String[] @default([])  // [agentId1, agentId2]
  w2VerifiedAt      DateTime?
  w2VerificationMethod String? // "paystub_submitted" | "tax_form_verified" | "employment_letter"

  // Tax documentation
  w2TaxFormPath     String?  // R2 key to uploaded W2
  w2Year            Int?
  ein               String?  // Employer ID (encrypted)

  // Independent contractor status (1099)
  ind_ssn_verified  Boolean @default(false)
  ind_w9Submitted   Boolean @default(false)  // W9 form uploaded
  ind_w9Path        String?  // R2 key

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  human             Human @relation(fields: [humanId], references: [id])
}

// Add to Job model:
contractorClassificationUsed String?  // "W2" | "1099" | null
```

**Classification Verification Flow**

**For 1099 (Independent Contractors):**
1. Contractor uploads W9 form
2. Backend stores in R2 with encryption
3. Agent can verify independent contractor status
4. Flag on profile: "1099 Ready" (W9 on file)

**For W-2 (Employees):**
1. Contractor uploads recent paystub + employment letter
2. Backend verifies:
   - Paystub shows valid payroll
   - Employment letter matches hiring agent
3. Tax form analyzed (OCR) to verify:
   - Salary/wage amount
   - Withholding
   - Social Security matches records
4. Classified as "W-2 Eligible for Agent [ABC]"
5. Badge on profile: "Eligible for W-2 employment with Agent ABC"

**API Endpoints**
```
POST   /api/classification/w9-upload        [Human] Upload W9 for 1099 status
       → Stores encrypted in R2, sets ind_w9Submitted=true

POST   /api/classification/w2-verify        [Human] Submit paystub for W2 eligibility
       Body: { agentId, paystubUrl, employmentLetterUrl }
       → OCR extraction, validation, stores encrypted

GET    /api/humans/:id/classification      [Public] View employment status

GET    /api/jobs/:jobId/classification    [Either] Confirm classification used
```

**Compliance Audit Trail**
```typescript
interface ClassificationAudit {
  jobId: string;
  contractorId: string;
  classificationUsed: 'W2' | '1099';
  agent: string;
  verificationMethod: string;
  verifiedAt: datetime;
  documentHash: string;  // For integrity check
}

// Log every job with its classification
await prisma.classificationAudit.create({
  data: {
    jobId, contractorId, classificationUsed,
    agent, verificationMethod, verifiedAt,
    documentHash: sha256(w9Form)
  }
});
```

### 7.3 Effort Estimate
- Data model + migration: 1 day
- W9/paystub upload + OCR: 2 days
- Verification logic: 2 days
- API endpoints: 1 day
- Audit logging: 1 day
- **Total: 7 days (1 week, round to 2 weeks)**

---

## SYNTHESIS: MVP VS FULL ROADMAP

### MINIMUM FEATURE SET (8/10 Score) — 8 Weeks

1. **Escrow + Dispute (Week 1-2)** → closes payment risk
2. **Licensing Verification (Week 2-3)** → closes credentialing
3. **Background Checks + Insurance (Week 3-5)** → closes liability
4. **SLA/Uptime Guarantees (Week 6)** → closes reliability
5. **W-2/1099 Classification (Week 6-7)** → closes tax compliance

**Why 8/10:** Covers the 5 core gaps (escrow, licensing, insurance, reliability, compliance). Broker can confidently use HP for contractor management with reduced risk.

### FULL FEATURE SET (9+/10 Score) — 16 Weeks

Add:
6. **MLS/CRM Integration (Week 7-10)** → seamless workflow
7. **Geofencing + Photo Validation (Week 10-12)** → proof-of-work

**Why 9+/10:** Complete platform integration. Broker never leaves their existing tools (Zillow, Follow Up Boss). Photos prove work was done. Every data privacy concern addressed.

---

## SEQUENCED ROADMAP

### Phase 1: Payment Trust + Credentialing (Weeks 1-5)
**Goal:** Move from 5/10 → 7/10

- Week 1-2: Deploy escrow contract, test on Base Sepolia
- Week 2-3: License verification integration (LexisNexis)
- Week 3-5: Background checks + insurance certificates

**Deliverable:** Broker can trust contractor payment, verify licenses, see insurance badge

### Phase 2: Enterprise Compliance (Weeks 6-8)
**Goal:** Move from 7/10 → 8/10

- Week 6: SLA monitoring dashboard
- Week 6-7: W-2/1099 classification system
- Week 8: Legal review + compliance audit

**Deliverable:** Broker has proof of contractor reliability & tax compliance

### Phase 3: Workflow Integration (Weeks 9-12)
**Goal:** Move from 8/10 → 8.7/10

- Week 9-10: MLS/CRM integrations (Zillow, FUB, Brivity, DocuSign)
- Week 11: Document redaction + access logging
- Week 12: Broker dashboard consolidation

**Deliverable:** Broker creates jobs from Zillow, sends docs, tracks signatures—all in one platform

### Phase 4: Proof-of-Work + Polish (Weeks 13-16)
**Goal:** Move from 8.7/10 → 9.2/10

- Week 13-14: Geofencing + photo validation
- Week 15: Mobile app enhancements (camera, GPS)
- Week 16: VP readiness—case studies, ROI calculator, white-glove onboarding

**Deliverable:** Contractor photos prove work done. Broker sees ROI: fewer disputes, faster closings, reduced liability.

---

## SCORE MAPPING

| Feature | Gap Closed | Effort | Score Gain |
|---------|-----------|--------|-----------|
| Escrow + Dispute | Payment risk | 2w | +1.5 |
| Licensing Verification | Credentialing | 3w | +1.2 |
| Background + Insurance | Liability/indemnification | 4w | +1.5 |
| MLS/CRM Integration | Workflow/privacy | 4w | +1.3 |
| Geofencing + Photo | Proof-of-work | 2w | +0.8 |
| SLA Guarantees | Reliability | 2w | +0.6 |
| W-2/1099 Handling | Tax compliance | 2w | +0.7 |
| **TOTAL** | All 7 gaps | 16w | **+8 → 9.2** |

---

## TECHNICAL DEBT & ARCHITECTURE

### Infrastructure Additions

**Blockchain Layer**
- Base L2 escrow contract (audited)
- Relayer wallet for verdict automation
- Monitor gas costs, add throttling if needed

**External APIs**
- LexisNexis (license verification)
- Checkr (background checks)
- Insurance partner (certificate issuance)
- MoltCourt (dispute resolution)
- Zillow, FUB, Brivity, DocuSign (CRM integrations)

**Data Privacy**
- Encrypt W9/tax forms at rest (AES-256)
- Document access logging (audit trail)
- PII redaction service (before sending docs to contractors)
- FCRA compliance (background check disclosures)

### Testing Strategy

**Unit Tests** (New)
- Escrow contract: 15 test cases
- License verification: 8 cases
- Background check webhook: 5 cases
- SLA evaluation: 10 cases
- Photo validation: 12 cases

**Integration Tests**
- End-to-end escrow flow (happy path + dispute)
- MLS property → HumanPages job creation
- DocuSign signature capture
- Geofencing + photo submission

**E2E Tests**
- Broker completes full job: search → offer → payment → escrow → release → dispute resolution
- Contractor submits photos, broker verifies, releases payment

---

## SUCCESS METRICS (FOR 9+/10 SCORE)

### By VP of Innovation:

**Capability Metrics**
- ✓ Jobs with escrow enabled: >80%
- ✓ Contractors with verified licenses: >70%
- ✓ Contractors with background checks: 100%
- ✓ Jobs with E&O insurance coverage: >60%
- ✓ Real estate agents using MLS integration: >40%
- ✓ Jobs with geoference + photos: >50%
- ✓ SLA violations < 5% (on Premium tier)

**Business Metrics**
- Job completion rate: 95%+
- Dispute rate: <2%
- Average time to payment: <24 hours
- Contractor retention (repeat use): >60%
- Real estate agent adoption: 20+ agents in first quarter
- Revenue per job: $50-200 (escrow fees 2-3%)

**Risk Metrics**
- Zero insurance claims related to unverified contractors
- Zero disputes escalated beyond MoltCourt
- Regulatory compliance: 0 FCRA violations, 0 tax classification disputes
- Data privacy: 0 unauthorized PII access incidents

---

## DEPENDENCIES & ASSUMPTIONS

**Critical Path Items:**
1. MoltCourt API stabilization (if disputes expected in Q1)
2. Insurance partner negotiation (3-4 month lead time)
3. Legal review for PII handling (2-3 weeks)
4. Contract audit for escrow (2-3 weeks)

**Assumptions:**
- Base L2 remains stable (no forced migration)
- LexisNexis API uptime >99.9%
- Real estate agents have Zillow/FUB/Brivity accounts (high probability)
- Mobile GPS/camera access available on iOS/Android (standard)

**Risk Mitigations:**
- Escrow contract uses approved arbitrators whitelist (no single-key risk)
- Document redaction: whitelist approach (deny by default, redact known PII)
- SLA suspension: reversible (contractor can re-apply after improvement)

---

## NEXT STEPS FOR PRODUCT TEAM

1. **Immediate (This Week):**
   - Schedule calls with Checkr, LexisNexis (API access + pricing)
   - Engage insurance broker for E&O product design
   - Begin escrow contract audit RFP

2. **Week 2-3:**
   - Lock feature scope with engineering
   - Create detailed Jira epics for each feature
   - Schedule MoltCourt API review

3. **Week 4+:**
   - Begin Phase 1 implementation (escrow + licensing)
   - Prepare case studies + ROI model for VP conversations
   - Start real estate broker interviews for MLS integration priorities

