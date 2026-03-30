# Feature Spec: Result Delivery Mechanism

**Priority:** Phase 2 (Ship Weeks 4-6, after Open Job Posting)
**Effort:** 1-2 weeks
**War Room Verdict:** True differentiator — closes the agent-human-agent loop. Combined with jury system, this is the moat.

---

## Why This Matters

Right now the job flow has a gap: human accepts a job, does the work, but there's no structured way to deliver results back to the agent. The agent has to check messages, parse free-text, or hope the human uploaded something somewhere. For an MCP-native platform where AI agents are the clients, this is broken.

The result delivery mechanism gives humans a structured way to submit work and gives agents a programmatic way to retrieve it. This is what makes HumanPages fundamentally different from MTurk's web forms — results flow directly into the agent's workflow via MCP tools.

### The Gap Today

```
Agent creates job → Human accepts → Human does work → ???
                                                      ↑
                                                      No structured result delivery.
                                                      Human might send a message.
                                                      Agent can't programmatically retrieve results.
```

### After

```
Agent creates job (with result_schema) →
  Human accepts →
  Human submits result (structured JSON + file attachments) →
  Agent retrieves result via MCP tool (get_job_result) →
  Agent validates result against schema →
  Agent approves or disputes
```

---

## What We're Building

A typed result submission system where agents define what they expect, humans submit structured results, and agents can programmatically validate and retrieve them.

### Core Concepts

- **Result Schema:** Agent defines expected result format when creating a job (e.g., "I need a JSON object with `translated_text` (string) and `confidence` (number)")
- **Result Submission:** Human submits structured data + optional file attachments
- **Result Validation:** Automatic validation against schema before acceptance
- **Result Retrieval:** Agent fetches results via MCP tool — ready to use in their workflow
- **Result Types:** Text, JSON, file upload, URL, or mixed

---

## Data Model

### New Prisma Models

```prisma
model JobResult {
  id              String        @id @default(cuid())
  jobId           String        @unique
  job             Job           @relation(fields: [jobId], references: [id])
  humanId         String
  human           Human         @relation(fields: [humanId], references: [id])

  // Result content
  resultType      ResultType    @default(TEXT)
  textContent     String?       // For TEXT type
  jsonContent     Json?         // For JSON type (validated against schema)
  urlContent      String?       // For URL type (link to external resource)

  // File attachments
  attachments     ResultAttachment[]

  // Validation
  schemaValid     Boolean?      // null = no schema, true = passed, false = failed
  validationErrors String[]     // If schema validation failed

  // Status
  status          ResultStatus  @default(SUBMITTED)
  submittedAt     DateTime      @default(now())
  approvedAt      DateTime?
  rejectedAt      DateTime?
  rejectionReason String?

  // Revision tracking
  version         Int           @default(1)
  previousVersionId String?     // Link to previous submission (if revised)

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([jobId])
}

enum ResultType {
  TEXT            // Plain text response
  JSON            // Structured JSON (validated against schema)
  URL             // Link to external resource
  FILE            // File upload only
  MIXED           // Combination of text/JSON + files
}

enum ResultStatus {
  SUBMITTED       // Human submitted, awaiting agent review
  APPROVED        // Agent approved the result
  REJECTED        // Agent rejected (with reason)
  REVISION_REQUESTED  // Agent wants changes
  DISPUTED        // Sent to jury (links to Dispute)
}

model ResultAttachment {
  id              String   @id @default(cuid())
  resultId        String
  result          JobResult @relation(fields: [resultId], references: [id])

  // File info
  fileName        String
  fileType        String   // MIME type
  fileSize        Int      // Bytes
  storageKey      String   // S3/R2 key
  storageUrl      String   // Public URL (signed, time-limited)

  // Metadata
  uploadedAt      DateTime @default(now())

  @@index([resultId])
}
```

### Changes to Job Model

```prisma
model Job {
  // ... existing fields ...

  // Result schema (defined by agent at job creation)
  resultSchema    Json?         // JSON Schema for expected result format
  resultType      String?       // Expected: TEXT | JSON | URL | FILE | MIXED

  // Result
  result          JobResult?
  resultApproved  Boolean?
}
```

### Result Schema Examples

Agent specifies this when creating a job:

```json
// Translation task
{
  "type": "object",
  "properties": {
    "translated_text": { "type": "string", "minLength": 1 },
    "source_language": { "type": "string" },
    "target_language": { "type": "string" },
    "word_count": { "type": "integer", "minimum": 1 }
  },
  "required": ["translated_text", "target_language"]
}

// Data labeling task
{
  "type": "object",
  "properties": {
    "labels": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "image_id": { "type": "string" },
          "category": { "type": "string", "enum": ["cat", "dog", "bird", "other"] },
          "confidence": { "type": "number", "minimum": 0, "maximum": 1 }
        },
        "required": ["image_id", "category"]
      }
    }
  },
  "required": ["labels"]
}

// Simple text task (no schema, just free text)
null  // No schema = accept any text
```

---

## API Endpoints

### Result Submission (Human)

```
POST   /api/jobs/:id/result          # Submit result (text, JSON, URL)
POST   /api/jobs/:id/result/upload   # Upload file attachment
PUT    /api/jobs/:id/result          # Revise result (new version)
GET    /api/jobs/:id/result          # View my submitted result
```

### Result Review (Agent)

```
GET    /api/jobs/:id/result          # Retrieve result (MCP-compatible)
POST   /api/jobs/:id/result/approve  # Approve result → job COMPLETED
POST   /api/jobs/:id/result/reject   # Reject with reason → human can revise
POST   /api/jobs/:id/result/revision # Request specific changes
```

### MCP Tools (New/Updated)

```
get_job_result     # Agent retrieves structured result (JSON-parseable)
approve_result     # Agent approves → triggers payment completion
reject_result      # Agent rejects with reason
request_revision   # Agent requests specific changes
```

### File Upload

```
POST   /api/upload/result-file       # Presigned URL for direct upload to S3/R2
GET    /api/uploads/:key             # Retrieve uploaded file (signed URL, 1-hour expiry)
```

---

## Result Submission Flow

### Human Submits Result

```
1. Human completes work
2. POST /api/jobs/:id/result
   Body: {
     resultType: "JSON",
     jsonContent: { translated_text: "Hola mundo", target_language: "es", word_count: 2 },
     attachments: ["upload-key-1"]  // Optional file references
   }
3. Server validates against job.resultSchema (if present)
   - If valid: result saved, status = SUBMITTED, agent notified
   - If invalid: 400 with validation errors, human can fix and resubmit
4. Job status → SUBMITTED
```

### Agent Reviews Result

```
1. Agent calls get_job_result via MCP
   Response: {
     resultType: "JSON",
     jsonContent: { translated_text: "Hola mundo", ... },
     attachments: [{ fileName: "source.txt", downloadUrl: "https://..." }],
     schemaValid: true,
     submittedAt: "2026-03-30T10:00:00Z",
     version: 1
   }

2a. Agent approves → POST /api/jobs/:id/result/approve
    Job status → COMPLETED
    Payment released (or marked for release)

2b. Agent rejects → POST /api/jobs/:id/result/reject
    Body: { reason: "Translation is incomplete, missing paragraph 3" }
    Human notified, can revise

2c. Agent requests revision → POST /api/jobs/:id/result/revision
    Body: { changes: "Please also include the word count" }
    Human receives revision request

3. If no response from agent within 48 hours after submission:
   Auto-approve (prevents agents from ghosting)
```

### Revision Flow

```
1. Agent rejects or requests revision
2. Human submits new result (PUT /api/jobs/:id/result)
3. New version created (version: 2), previous version preserved
4. Agent reviews new version
5. Max 3 revisions before auto-escalation to dispute
```

---

## File Storage

### Recommended: Cloudflare R2 (S3-compatible)

- Free egress (important for agents downloading results)
- S3-compatible API
- Signed URLs for security (1-hour expiry)
- Max file size: 100MB per attachment, 3 attachments per result

### Upload Flow

```
1. Human requests presigned URL: POST /api/upload/result-file
   Body: { fileName: "screenshot.png", fileType: "image/png", fileSize: 245000 }
   Response: { uploadUrl: "https://r2.../presigned", key: "results/abc123/screenshot.png" }

2. Human uploads directly to R2 via presigned URL (no server proxy)

3. Human includes key in result submission:
   POST /api/jobs/:id/result
   Body: { resultType: "MIXED", textContent: "Done!", attachments: ["results/abc123/screenshot.png"] }

4. Server verifies file exists at key before accepting
```

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `backend/src/routes/results.ts` | Result submission, retrieval, approval, rejection |
| `backend/src/routes/uploads.ts` | Presigned URL generation, file management |
| `backend/src/lib/resultValidation.ts` | JSON Schema validation for result content |
| `backend/src/lib/storage.ts` | S3/R2 client wrapper (presigned URLs, file ops) |
| `backend/src/cron/result-auto-approve.ts` | Auto-approve results after 48h agent inactivity |
| `backend/src/tests/results.test.ts` | Result submission + review test suite |
| `frontend/src/components/results/ResultSubmitForm.tsx` | Human result submission form |
| `frontend/src/components/results/ResultDisplay.tsx` | Agent/human view of submitted result |
| `frontend/src/components/results/FileUploader.tsx` | Drag-and-drop file upload component |
| `frontend/src/components/results/SchemaPreview.tsx` | Shows expected result format to human |
| `frontend/src/components/results/RevisionHistory.tsx` | Shows all result versions |

### Modified Files

| File | What Changes |
|------|-------------|
| `backend/prisma/schema.prisma` | Add JobResult, ResultAttachment models. Add resultSchema to Job. |
| `backend/src/app.ts` | Register results and uploads routes |
| `backend/src/routes/jobs.ts` | Add resultSchema to createJobSchema. Update submit endpoint. |
| `backend/src/lib/mcp-tools.ts` | Add get_job_result, approve_result, reject_result, request_revision tools |
| `frontend/src/pages/JobDetail.tsx` | Add result submission form (human), result display (both) |
| `frontend/src/lib/api.ts` | Add result and upload API methods |

---

## Dev Team Review Checklist

### Architect
- [ ] Result schema uses JSON Schema draft-07 (standard, well-supported)
- [ ] File uploads go directly to R2 via presigned URLs (no server proxy = no bandwidth cost)
- [ ] Presigned URLs expire after 1 hour (security)
- [ ] Result versioning preserves history (no overwrites)
- [ ] Auto-approve timeout (48h) prevents agent ghosting
- [ ] Max revision limit (3) prevents infinite loops before dispute escalation
- [ ] Result retrieval via MCP returns machine-parseable JSON (not HTML or free-text)

### QA
- [ ] Submit text result → agent retrieves → approves → job COMPLETED
- [ ] Submit JSON result → validates against schema → passes → submitted
- [ ] Submit JSON result → fails schema validation → 400 with errors
- [ ] Submit with file upload → presigned URL → direct upload → result includes file
- [ ] Agent rejects → human revises → agent approves (revision flow)
- [ ] 3 rejections → auto-escalate to dispute
- [ ] 48h no agent response → auto-approve
- [ ] File size limit enforced (100MB)
- [ ] File type restrictions (no executables: .exe, .bat, .sh)
- [ ] Presigned URL expires after 1 hour
- [ ] Large file upload (50MB) completes successfully

### UX
- [ ] Result submission form adapts to resultType (text area for TEXT, JSON editor for JSON, file dropzone for FILE)
- [ ] Schema preview shows human exactly what's expected ("We need: translated_text, target_language, word_count")
- [ ] Validation errors are inline and specific ("translated_text is required", not "Schema validation failed")
- [ ] File upload shows progress bar
- [ ] Revision request highlights what needs to change
- [ ] Version history is browsable (diff view between versions)

### Frontend
- [ ] JSON editor component with syntax highlighting (use Monaco or CodeMirror)
- [ ] File drag-and-drop works on mobile
- [ ] Image attachments have thumbnails
- [ ] Download button for file attachments
- [ ] Responsive layout for result display

### Backend
- [ ] JSON Schema validation uses ajv (standard library, battle-tested)
- [ ] File upload presigned URLs include content-type restriction
- [ ] Result submission is atomic (result + attachment references in one transaction)
- [ ] R2/S3 client is abstracted behind storage interface (easy to swap providers)
- [ ] Cron for auto-approve is idempotent

### User Feedback
- [ ] Track: % of jobs with schema vs. no schema (adoption rate)
- [ ] Track: schema validation failure rate (are schemas too strict?)
- [ ] Track: revision rate (are results frequently rejected?)
- [ ] Track: auto-approve rate (are agents ignoring results?)

### Product Manager
- [ ] Result delivery is the key differentiator vs. MTurk (structured, MCP-native)
- [ ] Predefined schemas for common task types (translation, data labeling, content review) — template library
- [ ] Premium feature opportunity: result quality scoring (AI-powered validation beyond schema)
- [ ] This feeds into jury system: disputed results include the schema + submission as evidence

### Critical 3rd-Party Reviewer
- [ ] File uploads are scanned for malware (ClamAV or R2's built-in scanning)
- [ ] No server-side execution of uploaded files
- [ ] Presigned URLs don't leak storage credentials
- [ ] CORS configured correctly on R2 bucket
- [ ] Result content is not indexed by search engines (private by default)

### Tech Blogger
- [ ] Write: "Structured task results: why our MCP tools return JSON, not emails"
- [ ] Demo: agent creates translation task → human submits → agent auto-parses result → uses in workflow
- [ ] Compare to MTurk's CSV export model

### DevOps Engineer (additional role)
- [ ] R2 bucket configured with lifecycle rules (delete files after 90 days for completed jobs)
- [ ] Storage costs estimated: at 1000 results/day × 5MB avg = 5GB/day = 150GB/month ≈ $2.25/month on R2
- [ ] Monitoring for upload failures and presigned URL expirations
- [ ] Backup strategy for result data

---

## Tests to Write

```
backend/src/tests/results.test.ts

describe('Result Delivery')
  describe('Submission')
    ✓ Human can submit text result
    ✓ Human can submit JSON result
    ✓ Human can submit URL result
    ✓ Human can submit with file attachments
    ✓ JSON result validated against job schema
    ✓ Invalid JSON result rejected with errors
    ✓ Cannot submit result for job not assigned to you
    ✓ Cannot submit result for PENDING job (must be PAID first)
    ✓ Result submission transitions job to SUBMITTED

  describe('File Upload')
    ✓ Presigned URL generated for valid file type
    ✓ Presigned URL rejected for executable file types
    ✓ File size limit enforced
    ✓ Presigned URL expires after 1 hour
    ✓ Attachment reference validated on result submission

  describe('Review')
    ✓ Agent can approve result → job COMPLETED
    ✓ Agent can reject with reason
    ✓ Agent can request revision with specific changes
    ✓ Non-owner agent cannot review result

  describe('Revision')
    ✓ Human can submit revised result (new version)
    ✓ Previous version preserved
    ✓ Max 3 revisions enforced
    ✓ 4th rejection auto-escalates to dispute

  describe('Auto-approve')
    ✓ Result auto-approved after 48h of agent inactivity
    ✓ Auto-approve only fires if result status is SUBMITTED
    ✓ Auto-approve is idempotent

  describe('MCP Tools')
    ✓ get_job_result returns structured JSON
    ✓ approve_result transitions job to COMPLETED
    ✓ reject_result transitions result to REJECTED
```

---

## Acceptance Criteria

1. Agents can define a result schema when creating jobs
2. Humans can submit structured results (text, JSON, files, URLs)
3. JSON results are validated against the schema before acceptance
4. Agents can retrieve results via MCP tools in machine-parseable format
5. Agents can approve, reject, or request revisions
6. File uploads go directly to R2 via presigned URLs
7. Auto-approve fires after 48h of agent inactivity
8. Max 3 revisions before auto-escalation to dispute
9. All tests pass

---

## Dependencies

- **Jury System (02):** Rejected results after max revisions escalate to dispute → jury
- **Open Job Posting (03):** Result schema defined at listing creation carries through to job
- **ERC-8004 Bridge (05):** Result quality metrics feed into on-chain reputation
