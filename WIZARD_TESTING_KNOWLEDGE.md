# Onboarding Wizard — Testing Knowledge Base

## Architecture Overview

The onboarding wizard has 3 core modules:

1. **`useStepFlow.ts`** — Pure step ordering engine. Two flows: `FLOW_NO_CV` (skills early) and `FLOW_CV_UPLOADED` (equipment early, skills deferred). Controlled by a single boolean `cvActive`.
2. **`useCvProcessing.ts`** — 3-stage async pipeline hook: client validation → server upload → server parse + data quality check. Exposes callbacks (`onFileSelected`, `onCvFailed`, `onParseComplete`) for the parent to control navigation.
3. **`index.tsx`** — Wizard orchestrator. Wires the hook callbacks to URL-based navigation (`setSearchParams`). Manages `cvActive` (optimistic flow toggle) and `returnToStepRef` (where to return after re-upload).

### Navigation Model

- Steps are URL-driven via `?step=<stepId>` search params
- Form data lives in React state (managed by `useProfileForm`), completely independent of step navigation
- Navigating between steps does NOT reset form data — this is why progress preservation works for free

---

## The 3-Stage CV Upload Flow

### Stage 1: Client-side file selection (instant)
- Validates file type (PDF/.docx only, .doc REJECTED), size (≤5MB)
- On valid file: calls `onFileSelected` callback **immediately, before any network request**
- Parent advances to equipment step, switches to CV flow optimistically
- State: `cvStage = 'uploading'`

### Stage 2: Upload to server (async, can be slow)
- Calls `api.uploadCvFile(file)` → returns `{ fileId }`
- Retries 3x with delays: 1.5s after 1st failure, 3s after 2nd failure
- On failure (all retries exhausted): calls `onCvFailed`, parent reverts to cv-upload + NO_CV flow
- On success: moves to stage 3
- State: remains `cvStage = 'uploading'`

### Stage 3: Parse + validate (async, polling)
- Polls `api.pollCvParse(fileId)` every 1.5s, up to 40 attempts (~60s)
- Poll responses: `{ status: 'pending' | 'complete' | 'failed', data?: any }`
- Network errors during polling are tolerated (keeps polling)
- On `status: 'failed'` or timeout: calls `onCvFailed`
- On `status: 'complete'`: runs data quality validation
- State: `cvStage = 'parsing'` during polling

### Data Quality Validation
- Primary signal: **skills count** (explicit + inferred combined)
- Threshold: `MIN_SKILLS_FOR_VALID_CV = 2`
- Missing name is OK if skills meet threshold
- If validation fails: calls `onCvFailed` with descriptive reason, fires `posthog.capture('cv_quality_rejected')`
- If passes: applies data to form fields, calls `onParseComplete`

### CV Data Shape (from server)
```typescript
{
  name: string;
  bio: string;
  location: string;
  skills: { explicit: string[]; inferred: string[] };  // NOT flat array
  languages: string[];  // "English (Native)" format, NOT objects
  education: { institution: string; degree: string; field: string; country: string; year: number }[];
  yearsOfExperience: number;
  linkedinUrl: string;
  githubUrl: string;
  twitterUrl: string;
  websiteUrl: string;
  externalProfileUrls: string[];
  certificates: any[];
}
```

### Flow Revert + Progress Preservation
- On failure: `cvActive = false` → flow reverts to NO_CV → user navigated to `?step=cv-upload`
- `returnToStepRef` saves the step the user was on when failure occurred
- On re-upload: `onFileSelected` reads `returnToStepRef` and navigates there (not always equipment)
- Form data is never cleared during any of this — it's in React state, independent of URL

### Duplicate Upload Prevention
- `cvUploadingRef.current = true` is set synchronously on file selection
- Second `processFile` call returns immediately if ref is true
- Ref is cleared on completion (success or failure) or unmount

---

## Step Flow Details

### NO_CV Flow (12 steps)
```
connect → cv-upload → skills → equipment → vouch → location → education → payment → services → profile → availability → verification
```

### CV Flow (12 steps, same IDs, different order)
```
connect → cv-upload → equipment → vouch → payment → skills → location → education → services → profile → availability → verification
```

Key difference: equipment at position 3 (CV) vs 4 (NO_CV), skills at position 6 (CV) vs 3 (NO_CV).

---

## Test Infrastructure

- **Test runner**: Vitest 4.x with jsdom environment
- **Component testing**: @testing-library/react (render, screen, waitFor, fireEvent)
- **Hook testing**: @testing-library/react `renderHook` + `act`
- **i18n mock**: returns translation keys as-is (e.g., `t('onboarding.cvUpload.heading')` → `'onboarding.cvUpload.heading'`)
- **Globals**: vitest globals enabled (describe/it/expect without import, but explicit import is the codebase pattern)

### Test File Structure

| File | Type | Tests | What it covers |
|------|------|-------|----------------|
| `useStepFlow.test.ts` | Unit | 25 | Flow ordering, switching, stepAt clamping, labels |
| `useCvProcessing.test.ts` | Unit (hook) | 43 | All 3 stages, validation, data quality, data application, unmount safety |
| `CvOnboardingFlow.test.tsx` | Integration | 18 | Full user journeys through wizard with CV upload |

---

## Critical Testing Lessons Learned

### 1. Fake timers vs Real timers — CANNOT MIX with waitFor

**`vi.useFakeTimers()` + `waitFor()` from @testing-library/react DEADLOCKS.**

`waitFor` internally uses `setTimeout` to retry assertions. When fake timers are active, `waitFor` never progresses because its own setTimeout is frozen.

**Rule**:
- **Hook tests** (`renderHook`): Use `vi.useFakeTimers()` + `vi.advanceTimersByTime()` wrapped in `act()`. No `waitFor` needed.
- **Integration tests** (full component render): Use **real timers** only. Accept that retry tests take ~5s real time. Set `{ timeout: 15000 }` on `waitFor` and test-level timeout via second arg to `it()`.

### 2. The processFileAndSettle pattern (for hook tests with fake timers)

```typescript
async function processFileAndSettle(result: any, file: File) {
  await act(async () => {
    result.current.processFile(file);
  });
  // Advance through retry delays (1.5s, 3s) and poll intervals (1.5s × 40)
  for (let i = 0; i < 50; i++) {
    await act(async () => {
      vi.advanceTimersByTime(1600);
    });
  }
}
```

This works because each `act` + `advanceTimersByTime` combo lets pending microtasks (resolved promises) flush between timer ticks.

### 3. Integration test step navigation pattern

```typescript
// Navigate to a specific step before rendering
window.history.pushState({}, '', '?step=cv-upload');
renderWithProviders(<Onboarding />);

// Wait for step heading (i18n mock returns keys as-is)
await waitFor(() => {
  expect(screen.getByText('onboarding.cvUpload.heading')).toBeInTheDocument();
});

// Trigger file upload via hidden input
const input = document.querySelector('input[type="file"][accept*="pdf"]') as HTMLInputElement;
fireEvent.change(input, { target: { files: [file] } });

// Verify navigation happened
await waitFor(() => {
  expect(window.location.search).toContain('step=equipment');
});
```

### 4. File input disappears after navigation

After `onFileSelected` fires and the step changes, the cv-upload step unmounts. The file input no longer exists in the DOM. If you need to fire multiple uploads, grab the input reference BEFORE the first upload triggers navigation.

### 5. Mock CV data format matters

The hook expects `skills: { explicit: string[], inferred: string[] }`, NOT a flat array. Languages are strings like `"English (Native)"`, NOT objects. Education uses `institution/degree/field/country/year`, NOT `school/fieldOfStudy/startDate/endDate`. Social URLs are top-level fields (`linkedinUrl`, `githubUrl`), NOT inside an `externalProfiles` array.

### 6. Retry timing in integration tests

Upload retries have real `setTimeout` delays: 1.5s between attempt 1→2, 3s between attempt 2→3. A full 3-retry failure cycle takes ~4.5s real time. Set test timeout to 15000ms:

```typescript
it('should revert after retries', async () => {
  // ... test body ...
}, 15000);  // ← second arg to it()
```

And `waitFor` timeout:
```typescript
await waitFor(() => {
  expect(window.location.search).toContain('step=cv-upload');
}, { timeout: 15000 });
```

### 7. Toast mock pattern

```typescript
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), promise: vi.fn() }),
}));
```

Then assert: `expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('5MB'))`.

The `Object.assign(vi.fn(), ...)` is needed because `toast` is both a function AND has `.success`/`.error` methods.

### 8. Unmount safety testing

```typescript
const { result, unmount } = renderHook(() => useCvProcessing(targets));

// Start async operation
vi.mocked(api.uploadCvFile).mockImplementation(
  () => new Promise((resolve) => { uploadResolve = resolve; })
);
await act(async () => { result.current.processFile(pdfFile); });

// Unmount + set ref
unmount();
targets.mountedRef.current = false;

// Resolve the pending promise
await act(async () => { uploadResolve!({ fileId: 'cv-123' }); });

// Verify no callbacks fired
expect(targets.onParseComplete).not.toHaveBeenCalled();
```

Note: `cvStage` will be `'uploading'` (set synchronously before unmount), NOT `'idle'`. Only check that callbacks weren't called, not that state reverted.

### 9. Testing skill dedup logic

The `setSkills` mock needs to execute the updater function to verify merge behavior:

```typescript
targets.setSkills.mockImplementation((fn: any) => {
  if (typeof fn === 'function') return fn(['javascript', 'Python']);
});

// After processFile completes:
const updaterCall = targets.setSkills.mock.calls.find(
  (call: any[]) => typeof call[0] === 'function'
);
const merged = updaterCall![0](['javascript', 'Python']);
expect(merged).toContain('React');       // new skill added
expect(merged).not.toContain('JavaScript'); // deduped (case-insensitive match with 'javascript')
expect(merged).toHaveLength(3);
```

### 10. Testing flow revert + re-upload (the full cycle)

```typescript
// First upload: 3 retries fail, then re-upload succeeds
vi.mocked(api.uploadCvFile)
  .mockRejectedValueOnce(new Error('fail'))
  .mockRejectedValueOnce(new Error('fail'))
  .mockRejectedValueOnce(new Error('fail'))
  .mockResolvedValueOnce({ fileId: 'f-retry' });

// First upload → equipment → failure → cv-upload
uploadFile(createMockFile('resume.pdf', 'application/pdf'));
await waitFor(() => { expect(window.location.search).toContain('step=equipment'); });
await waitFor(() => { expect(window.location.search).toContain('step=cv-upload'); }, { timeout: 15000 });

// Re-upload → returns to equipment (saved by returnToStepRef)
uploadFile(createMockFile('resume_v2.pdf', 'application/pdf'));
await waitFor(() => { expect(window.location.search).toContain('step=equipment'); });
```

---

## API Endpoints

| Endpoint | Method | Request | Response |
|----------|--------|---------|----------|
| `/cv/upload-file` | POST | FormData with `cv` field | `{ fileId: string }` |
| `/cv/parse-status/:fileId` | GET | — | `{ status: 'pending' \| 'complete' \| 'failed', data?: CvData, error?: string }` |
| `/cv/upload` (deprecated) | POST | FormData with `cv` field | CvData directly (synchronous upload+parse) |

---

## Common Mock Setup (for integration tests)

```typescript
// Required mocks for Onboarding component to render:
vi.mocked(api.getProfile).mockResolvedValue({} as any);
vi.mocked(api.updateProfile).mockResolvedValue({} as any);
mockGetApplyIntent.mockReturnValue(null);
mockGetListingApplyIntent.mockReturnValue(null);

// For successful CV flow:
vi.mocked(api.uploadCvFile).mockResolvedValue({ fileId: 'f-1' });
vi.mocked(api.pollCvParse).mockResolvedValue({ status: 'complete', data: goodCvData });

// For upload failure:
vi.mocked(api.uploadCvFile).mockRejectedValue(new Error('Network error'));

// For parse failure:
vi.mocked(api.uploadCvFile).mockResolvedValue({ fileId: 'f-1' });
vi.mocked(api.pollCvParse).mockResolvedValue({ status: 'failed' });

// For data quality rejection:
vi.mocked(api.uploadCvFile).mockResolvedValue({ fileId: 'f-1' });
vi.mocked(api.pollCvParse).mockResolvedValue({ status: 'complete', data: sparseCvData });

// For in-progress states:
vi.mocked(api.uploadCvFile).mockImplementation(() => new Promise(() => {})); // never resolves
vi.mocked(api.pollCvParse).mockImplementation(() => new Promise(() => {}));   // never resolves
```

---

## Step Component Headings (for assertions)

Since i18n is mocked to return keys as-is, use these in assertions:

| Step | Heading key |
|------|-------------|
| connect | `onboarding.connect.heading` |
| cv-upload | `onboarding.cvUpload.heading` |
| skills | `onboarding.skills.heading` |
| equipment | `onboarding.equipment.heading` |
| vouch | `onboarding.vouch.heading` |
| location | `onboarding.location.heading` |
| education | `onboarding.education.heading` |
| payment | `onboarding.payment.heading` |
| services | `onboarding.services.heading` |
| profile | `onboarding.profile.heading` |
| availability | `onboarding.availability.heading` |
| verification | `onboarding.finish.heading` |

The skip button text is `common.skipForNow`.

---

## Known Issues

- The old `Onboarding.test.tsx` has 16 pre-existing failures because it was written for a different step order (step 1 = Identity with "Let's get to know you"). The current flow starts with 'connect'. Those tests need updating separately.
- `window.scrollTo` is not implemented in jsdom — you'll see console warnings. Harmless.
- The `equipmentOnly` prop on `StepServices` component renders the equipment heading (`onboarding.equipment.heading`) vs the full services heading (`onboarding.services.heading`).
