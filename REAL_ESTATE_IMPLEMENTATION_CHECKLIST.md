# HumanPages Real Estate Implementation Checklist
## Week-by-Week Execution Plan (16 Weeks to 9+/10)

---

## PHASE 1: FOUNDATION (Weeks 1-5) — Target: 7/10 Score

### Week 1-2: Escrow Smart Contract + Base Deployment

**Engineering (Smart Contract)**
- [ ] Set up Foundry project structure
- [ ] Write `HumanPagesEscrow.sol` (escrow, release, propose-cancel, dispute, resolve)
- [ ] Write 15 test cases (happy path, dispute, timeout, blacklist, pause)
- [ ] Security audit RFP (send to 3 audit firms, collect proposals)
- [ ] Deploy to Base Sepolia testnet
- [ ] Write deployment script + constructor args

**Backend**
- [ ] Prisma schema migration (EscrowStatus enum, escrow fields on Job)
- [ ] `backend/src/lib/blockchain/escrow.ts` service (contract interactions)
- [ ] `backend/src/lib/blockchain/moltcourt.ts` service (dispute API)
- [ ] Relayer wallet setup (AWS KMS or encrypted keystore)

**DevOps**
- [ ] Environment variables: ESCROW_CONTRACT_BASE, MOLTCOURT_API_KEY, ESCROW_RELAYER_PRIVATE_KEY
- [ ] Fund relayer wallet with $10 ETH (covers ~1000 verdict relays)

**Acceptance Criteria**
- ✓ 15/15 test cases pass
- ✓ Base Sepolia deployment successful
- ✓ Relayer wallet funded
- ✓ Audit proposal received

---

### Week 2-3: Licensing Verification Integration

**Product**
- [ ] Add LicenseType enum to profile-schema.json
- [ ] Design onboarding wizard step: "License Verification"

**Backend**
- [ ] Prisma migration: `ContractorLicense` model + `licensesVerifiedAt` on Human
- [ ] LexisNexis API client: `backend/src/lib/license-verification.ts`
- [ ] API endpoints: POST verify, GET licenses, PATCH status, GET pending (admin)
- [ ] Caching layer: 90-day TTL for verified licenses

**Frontend**
- [ ] New wizard step: upload license number, state, expiration
- [ ] Profile display: "Licensed HVAC Technician (CA), Expires June 2027"
- [ ] Agent search filter: "Show only licensed electricians in CA"
- [ ] Expired license warnings (30-day notice)

**Acceptance Criteria**
- ✓ LexisNexis API integrated
- ✓ 10+ licenses verified (internal test)
- ✓ Profile displays correctly
- ✓ Caching working (verified check takes <100ms)

---

### Week 3-5: Background Checks + E&O Insurance

**Product & Legal**
- [ ] Checkr API account + webhook setup
- [ ] Insurance partner selection (The Hartford, Stride, Beehive)
- [ ] Insurance product design (certificate issuance, pricing)
- [ ] FCRA compliance review (disclosures, opt-out)

**Backend**
- [ ] Prisma migration: `BackgroundCheck` + `InsuranceCertificate` models
- [ ] Checkr webhook handler: `POST /api/background-check/webhook/checkr`
- [ ] Background check request: `POST /api/background-check/:humanId/request`
- [ ] Insurance certificate generation: `POST /api/insurance/purchase/:contractorId`
- [ ] Certificate verification endpoint: `POST /api/insurance/verify/:code`

**Frontend**
- [ ] Wizard step: "Background Check & Insurance"
- [ ] Profile section: "Trust & Insurance" (check status, certificate download)
- [ ] Insurance purchase flow (in-app or redirect to partner)

**Acceptance Criteria**
- ✓ Checkr integration end-to-end (test webhook)
- ✓ 5+ background checks completed
- ✓ Insurance certificate generated + downloadable
- ✓ FCRA legal review completed

---

**After Week 5: Score Checkpoint**
- ✓ Escrow deployed (payment trust)
- ✓ Licensing verified (credentialing)
- ✓ Background checks + insurance (liability protection)
- **Target Score: 7/10** (3 major gaps closed)

---

## PHASE 2: ENTERPRISE COMPLIANCE (Weeks 6-8) — Target: 8/10 Score

### Week 6: SLA/Uptime Guarantees

**Backend**
- [ ] Prisma migration: `ContractorSLA` model + fields on Job
- [ ] SLA tier definitions (STANDARD, PREMIUM, ENTERPRISE)
- [ ] Nightly cron: `evaluateContractorSLA()` (metrics computation)
- [ ] API endpoints: GET SLA, PATCH tier, admin flagging/suspension
- [ ] SLA violations logging

**Frontend**
- [ ] Contractor profile: SLA tier badge + metrics
- [ ] Search filter: "Premium SLA only"
- [ ] Dashboard: contractor SLA status

**Acceptance Criteria**
- ✓ Nightly cron working (no errors)
- ✓ Metrics computed correctly (response time, acceptance rate)
- ✓ Profile displays SLA tier

---

### Week 6-7: W-2/1099 Contractor Classification

**Backend**
- [ ] Prisma migration: `ContractorClassification` + `ClassificationAudit` models
- [ ] W9 upload + storage (encrypted in R2)
- [ ] Paystub OCR extraction (AWS Textract or Google Vision)
- [ ] Classification verification logic
- [ ] Audit trail logging
- [ ] API endpoints: POST w9, POST w2-verify, GET classification

**Frontend**
- [ ] Contractor dashboard: classification status + W9 upload
- [ ] W2 verification flow (upload paystub + letter)
- [ ] Job record: tag with classification used

**Legal**
- [ ] Tax attorney review (W-2 vs 1099 rules)
- [ ] IRS audit trail documentation

**Acceptance Criteria**
- ✓ W9 encrypted in R2
- ✓ Paystub OCR working (test 5 documents)
- ✓ Classification audit trail created
- ✓ Legal review completed

---

### Week 8: Legal Review + Compliance Audit

**Legal & Compliance**
- [ ] Contract audit completed (Checkr third-party firm report)
- [ ] FCRA compliance sign-off
- [ ] Tax classification guidance documented
- [ ] Insurance partnership agreement signed
- [ ] Data privacy review (PII handling, GDPR if needed)

**Acceptance Criteria**
- ✓ All legal reviews completed
- ✓ No major findings
- ✓ Ready for enterprise pilots

---

**After Week 8: Score Checkpoint**
- ✓ SLA guarantees live
- ✓ W-2/1099 classification working
- ✓ Legal reviews complete
- **Target Score: 8/10** (5 gaps closed, ready for enterprise pilots)

---

## PHASE 3: WORKFLOW INTEGRATION (Weeks 9-12) — Target: 8.7/10 Score

### Week 9-10: MLS/CRM Integration (Zillow + Follow Up Boss + Brivity + DocuSign)

**Backend - OAuth Setup (All 4 Platforms)**
- [ ] Register OAuth apps with all 4 platforms
- [ ] Callback handlers for each platform
- [ ] Token storage + encryption (AWS Secrets Manager)
- [ ] Token refresh logic

**Zillow Integration**
- [ ] Zillow API client: fetch property details
- [ ] Job pre-population: address, buyer name, closing date
- [ ] API: `POST /api/integrations/zillow/create-job`

**Follow Up Boss Integration**
- [ ] FUB API client: create contact, update pipeline
- [ ] Job completion sync to FUB pipeline
- [ ] API: `POST /api/integrations/followupboss/sync-contact`

**Brivity Integration**
- [ ] Brivity API client: fetch documents
- [ ] Document redaction service: `backend/src/lib/docRedaction.ts`
- [ ] API: `POST /api/integrations/brivity/send-docs`
- [ ] Webhook: document access logging

**DocuSign Integration**
- [ ] DocuSign API client: create envelopes
- [ ] E-signature field mapping
- [ ] API: `POST /api/integrations/docusign/request-signature`
- [ ] Webhook: signature completion

**Frontend**
- [ ] Job creation: select source platform
- [ ] Pre-filled form from platform data
- [ ] Document attachment + redaction confirmation
- [ ] Signature status tracking

**Acceptance Criteria**
- ✓ All 4 OAuth flows working
- ✓ Job created from Zillow property (address pre-filled)
- ✓ Doc sent via Brivity, redaction applied
- ✓ DocuSign signature captured
- ✓ Job completion synced to FUB

---

### Week 11: Document Redaction + Access Logging

**Backend**
- [ ] Document redaction service refinement (PII patterns)
- [ ] Access logging database: who accessed what, when, from where
- [ ] Audit trail API: GET document access log
- [ ] Compliance dashboard: document activity

**Frontend**
- [ ] Before sending: "These sections will be redacted: SSN, Commission, Buyer Financial Info"
- [ ] After sending: access log visible to agent

**Acceptance Criteria**
- ✓ Redaction working (5 test documents)
- ✓ Access logs created for each view
- ✓ Audit trail queryable

---

### Week 12: Broker Dashboard Consolidation

**Frontend**
- [ ] Unified contractor dashboard (all platforms in one view)
- [ ] Recent jobs (from all sources)
- [ ] Quick filters (by platform, status, contractor)
- [ ] Quick actions (send docs, request signature, pay)

**Acceptance Criteria**
- ✓ Dashboard loads <2s
- ✓ All job sources visible
- ✓ One-click actions working

---

**After Week 12: Score Checkpoint**
- ✓ Zillow integration live
- ✓ Document redaction + access logging
- ✓ DocuSign signature capture
- ✓ Unified broker dashboard
- **Target Score: 8.7/10** (6 gaps closed, seamless workflow)

---

## PHASE 4: PROOF-OF-WORK + POLISH (Weeks 13-16) — Target: 9.2/10 Score

### Week 13-14: Geofencing + Photo Validation

**Backend**
- [ ] Photo metadata extraction service (GPS, timestamp, resolution)
- [ ] Photo validation logic (geofence, timestamp window, duplicates)
- [ ] Geofence creation on job form
- [ ] API: `POST /api/jobs/:jobId/submit-photos`
- [ ] Validation report endpoint

**Mobile App**
- [ ] Camera permission requests (iOS/Android)
- [ ] GPS-tagged photo capture
- [ ] Real-time validation feedback ("✓ Photo valid")
- [ ] Submit photos UI

**Frontend Web**
- [ ] Map-based geofence editor (draw 50m radius)
- [ ] Photo grid view (timestamps, GPS status)
- [ ] Validation summary before job completion

**Acceptance Criteria**
- ✓ GPS metadata extracted from test photos
- ✓ Geofence validation working (5 test jobs)
- ✓ Mobile app camera integration
- ✓ Duplicate detection working

---

### Week 15: Mobile App Enhancements + Case Studies

**Mobile**
- [ ] GPS/camera permission flows improved
- [ ] Offline photo upload (queue if no connection)
- [ ] Photo preview before submit

**Marketing & Product**
- [ ] Case study #1: mid-size brokerage (150 agents, 50% adoption, $100K savings)
- [ ] Case study #2: enterprise brokerage (500+ agents, escrow adoption)
- [ ] ROI calculator (inputs: agent count, jobs/agent, savings estimate)
- [ ] White-glove onboarding playbook (for pilots)

**Acceptance Criteria**
- ✓ 2 case studies documented with broker quotes
- ✓ ROI calculator ready for VP conversations

---

### Week 16: VP-Ready Polish + Final Testing

**QA & Testing**
- [ ] End-to-end test: broker creates job from Zillow → sends docs → collects signature → contractor submits photos → escrow release
- [ ] Stress test: simulate 100 concurrent jobs
- [ ] Performance optimization (dashboard load time <2s)

**Documentation**
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Contractor onboarding guide
- [ ] Broker admin guide
- [ ] FAQ & troubleshooting

**Launch Readiness**
- [ ] Security checklist complete
- [ ] Backup + disaster recovery tested
- [ ] Customer support playbook written
- [ ] Pilot broker onboarding calendar scheduled

**Acceptance Criteria**
- ✓ End-to-end test passes
- ✓ Performance benchmarks met
- ✓ Documentation complete
- ✓ Pilot 1 onboarding scheduled
- **Final Score: 9.2+/10** (all 7 gaps closed)

---

## PARALLEL WORKSTREAMS (Throughout 16 Weeks)

### Sales & Partnerships

**Weeks 1-8:**
- [ ] Identify 3 pilot brokerages (50+ agents, high pain)
- [ ] Schedule discovery calls (understand specific workflows)
- [ ] Draft LOI for pilots (3-month, 100+ jobs/month commitment)

**Weeks 9-12:**
- [ ] Close Pilot #1 contract
- [ ] Begin Pilot #1 onboarding (staggered, weeks 12-13)
- [ ] Identify 5 expansion brokerages

**Weeks 13-16:**
- [ ] Pilot #1 goes live (week 13)
- [ ] Collect success metrics + testimonial
- [ ] Close Pilot #2 + #3 contracts
- [ ] Create case study from Pilot #1

### Fundraising (if applicable)

**Weeks 1-4:**
- [ ] Prepare investor deck (VP pitch condensed to 10 slides)
- [ ] Financial model: Year 1-3 projections

**Weeks 5-8:**
- [ ] Investor meetings (if pursuing additional funding)
- [ ] Finalize use of proceeds (engineering, integrations, pilot support)

### External Vendor Management

**Weeks 1-2:**
- [ ] Checkr account setup + webhook configuration
- [ ] LexisNexis API access + testing
- [ ] Insurance partner negotiations

**Weeks 3-6:**
- [ ] Contract audit firm engagement
- [ ] Zillow, FUB, Brivity, DocuSign OAuth app approval

**Weeks 7-12:**
- [ ] MoltCourt API stabilization (if disputes coming early)
- [ ] AWS KMS setup (for secrets management)

---

## RISK MANAGEMENT & CONTINGENCIES

### Critical Path Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Escrow contract audit delays | Medium (30%) | High (2 weeks) | Start audit RFP week 1, use interim testnet-only |
| LexisNexis API delays | Low (10%) | Medium (1 week) | Fallback: manual verification path |
| Insurance partner negotiations | Medium (40%) | Medium (3 weeks) | Negotiate parallel track (weeks 1-3) |
| MoltCourt API instability | Low (15%) | High (4 weeks) | Timeout fallback always works, disputed jobs still resolve |
| Zillow/FUB API changes | Low (10%) | Medium (2 weeks) | Monitor API status, maintain sdk versions |

### Go-No-Go Decision Points

**Week 5 (Go/No-Go #1: Escrow Ready?)**
- ✓ Contract audit complete, no major findings
- ✓ Testnet deploy working
- If NO: delay Phase 2 until audit passed

**Week 8 (Go/No-Go #2: Compliance Ready?)**
- ✓ Legal reviews completed
- ✓ Pilot brokerages LOI signed
- If NO: extend week 8 to finalize legal, delay Phase 3 start to week 9

**Week 12 (Go/No-Go #3: Pilot Ready?)**
- ✓ All integrations working
- ✓ Pilot #1 onboarding resources prepared
- If NO: scale back integrations (Zillow only), launch Pilot Q2 instead

---

## SUCCESS METRICS (After Week 16)

### Quantitative Targets

| Metric | Target | Status |
|--------|--------|--------|
| Escrow jobs | 100+ | Go-live week 6 |
| Verified licenses | 500+ | Go-live week 10 |
| Background checks | 100% | Go-live week 12 |
| MLS integrations | 4/4 | Go-live week 16 |
| Photo-validated jobs | 50%+ | Go-live week 16 |
| Dispute rate | <2% | Measure ongoing |
| Job completion rate | 95%+ | Measure ongoing |

### Qualitative Targets

- ✓ VP score: 9+/10 (verified via pitch conversation)
- ✓ Pilot broker quote: "This is a game-changer for our operation"
- ✓ Legal sign-off: "Zero compliance risk"
- ✓ Media interest: 1+ press mention (TechCrunch, RE/MAX blog, etc.)

---

## RESOURCE PLAN

### Engineering (Permanent)

- **1 Senior Engineer (Solidity/Blockchain):** Smart contract + Checkr/Zellis integrations
- **2 Full-Stack Engineers (Node.js/React):** APIs, frontend, integrations, geofencing
- **1 DevOps Engineer (AWS/Kubernetes):** Infrastructure, Relayer wallet, monitoring

**Total: 4 FTE** (cost: $400-500K over 16 weeks)

### Contractor Support (Project-Based)

- **Security Auditor:** Week 1-4 (escrow audit) — $15K
- **Tax Attorney:** Week 6-8 (W-2/1099 guidance) — $5K
- **Insurance Broker:** Week 3-5 (partner negotiation) — $0 (revenue share)

### Product & Marketing

- **Product Manager (1 FTE):** Roadmap, vendor management, pilot coordination
- **Marketer (0.5 FTE):** Case studies, ROI calculator, white-glove onboarding docs

---

## DECISION LOG

### Week 1 Decisions

- [ ] Approve 4 FTE engineering budget
- [ ] Select escrow contract audit firm
- [ ] Approve LexisNexis contract ($300/month)
- [ ] Schedule Checkr + insurance partner calls

### Week 5 Decisions

- [ ] Go/No-Go: Escrow audit findings acceptable?
- [ ] Approve insurance partnership agreement
- [ ] Target 3 specific pilot brokerages

### Week 8 Decisions

- [ ] Go/No-Go: All legal reviews complete?
- [ ] Approve Zillow + FUB API spend
- [ ] Schedule Pilot #1 kickoff (week 12)

### Week 12 Decisions

- [ ] Go/No-Go: All integrations working?
- [ ] Launch Pilot #1 live (week 13 or delay?)
- [ ] Approve additional marketing budget for case studies

---

## LAUNCH COMMUNICATION

### Week 6 (Internal Announcement)
"HumanPages is now the first contractor platform with on-chain escrow and verified licensing. Our 2-week pilot with [Broker Name] starts next week."

### Week 10 (Blog Post)
"We've built 5 features real estate brokers have been asking for: Escrow, Licensing, Insurance, SLA Guarantees, and W-2/1099 Compliance."

### Week 16 (Major Launch)
"HumanPages for Real Estate is live. Escrow ✓, MLS Integration ✓, Photo Proof-of-Work ✓, E&O Insurance ✓. The contractor platform brokers have been waiting for."

---

## APPENDIX: Configuration & Rollout

### Feature Flags (for staged rollout)

```
FEATURE_ESCROW_ENABLED=true
FEATURE_LICENSING_VERIFICATION=true
FEATURE_BACKGROUND_CHECKS=true
FEATURE_INSURANCE_CERTIFICATES=true
FEATURE_MLS_INTEGRATION=true
FEATURE_GEOFENCING=true
FEATURE_SLA_MONITORING=true
FEATURE_W2_1099_TRACKING=true
```

### Rollout Stages

**Stage 1 (Internal):** All features 100% enabled, QA testing
**Stage 2 (Pilot #1):** All features enabled, close monitoring
**Stage 3 (Pilot #2-3):** Phased rollout per broker needs
**Stage 4 (General Release):** All features, feature flags default ON

---

## CONCLUSION

16-week roadmap to 9+/10 VP score. Every feature has concrete deliverables, clear acceptance criteria, and integrated into a sequenced roadmap that doesn't block critical path.

**Key insight:** The first 8 weeks (escrow + licensing + insurance + SLA) gets us to 8/10 — enterprise-viable. The final 8 weeks (integrations + geofencing) gets us to 9+/10 — market-leading.

Ship Phase 1 by week 8 with Pilot #1, collect testimonials, iterate on Phase 2 based on real feedback.

Go build.
