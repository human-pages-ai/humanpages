# Claude Instructions for HumanPages

## Single Point of Truth

Before modifying ANY profile field, wizard step, enum value, or data model:

1. **Read `shared/profile-schema.json` first.** This is the canonical reference for all profile fields, their types, valid enum values, which wizard step collects them, where they're stored (DB column + frontend state name), and validation rules.

2. **Keep all three layers in sync.** Every field must match across:
   - Prisma schema (`backend/prisma/schema.prisma`)
   - Backend Zod validation (`backend/src/routes/humans.ts` updateProfileSchema, `backend/src/routes/services.ts`, `backend/src/routes/cv.ts`)
   - Frontend types (`frontend/src/pages/onboarding/types.ts`)
   - Frontend form state (`frontend/src/pages/onboarding/hooks/useProfileForm.ts`)
   - Frontend submit payload (`frontend/src/pages/onboarding/index.tsx` handleFinalSubmit)
   - Frontend API client (`frontend/src/lib/api.ts`)

3. **Update `shared/profile-schema.json` when adding/changing fields.** If you add a new field, enum value, or wizard step, update the schema file too.

4. **Never introduce a field in one layer without wiring it through all layers.** A frontend input with no backend storage is a data-loss bug. A backend field with no frontend is dead code.

## Enum Values

All enum values live in `shared/profile-schema.json` under the `enums` key. When referencing enums in code, use the exact values from there. Key enums:

- **RateType** (priceUnit): HOURLY, FLAT_TASK, PER_WORD, PER_PAGE, NEGOTIABLE
- **WorkType**: digital, physical, both
- **FreelancerJobsRange**: new, 1-10, 10-50, 50-100, 100-500, 500+
- **PaymentPreference**: UPFRONT, ESCROW, UPON_COMPLETION, STREAM
- **WorkMode**: REMOTE, ONSITE, HYBRID

The frontend may display user-friendly labels (e.g., "per hour") but the backend UNIT_MAP in `services.ts` transforms them to enum values before saving.

## Wizard Step Flow

Two flows exist (defined in `frontend/src/pages/onboarding/useStepFlow.ts`):
- **NO_CV**: connect → cv-upload → skills → equipment → vouch → location → education → payment → services → profile → availability → verification
- **CV uploaded**: connect → cv-upload → equipment → vouch → payment → skills → location → education → services → profile → availability → verification

The difference: CV pre-fills skills/location/education, so those steps move later for user verification.

## Privacy Rules

- `publicHumanSelect` in `humans.ts` must NEVER include: name, email, phone, whatsapp, sms, telegram, telegramChatId, notification preferences, OAuth IDs, passwordHash
- Name is masked as "FirstName L." on public profiles
- Bio is sanitized by `sanitizeBio()` in `cv.ts` (strips name, email, phone) before saving
- Notification flags are aggregated to `channelCount` for public display

## Testing

Tests should reference `shared/profile-schema.json` for valid field names, enum values, and expected data shapes rather than hardcoding them.

## Common Pitfalls

- **priceUnit mismatch**: Frontend sends "per hour", backend expects "HOURLY". The UNIT_MAP in `services.ts` handles the transform. Don't skip it.
- **Education year fields**: Use `startYear` and `endYear`, not the legacy `year` field. The `year` column is auto-synced from `endYear` for backward compat.
- **Languages format**: Stored as "Language (Proficiency)" strings (e.g., "English (Native)"), NOT ISO codes.
- **Equipment format**: "Category - Tool" (e.g., "Phone - iPhone 15") or just category.
- **Prisma migrations**: `setup.sh` runs `prisma migrate dev` which may auto-generate conflicting migrations. Delete any auto-generated `*_init` migration and re-run.
