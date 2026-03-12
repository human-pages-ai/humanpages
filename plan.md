# Short Links for Listings — `/work/:code`

## Summary
4-char lowercase codes (a-z, 2-9), 10 per listing. Code #1 is the default share link, codes #2-10 are for marketing campaign tracking via admin board.

`humanpages.ai/work/ab3k` → redirects to `/listings/:id` with tracking

## Database

**New model: `ListingLink`**
```
model ListingLink {
  id        String   @id @default(cuid())
  code      String   @unique          // 4-char lowercase: a-z, 2-9
  listingId String
  listing   Listing  @relation(fields: [listingId], references: [id], onDelete: Cascade)
  label     String?                   // Admin note: "telegram-manila", "fb-cebu", etc.
  clicks    Int      @default(0)      // Simple counter
  createdAt DateTime @default(now())

  @@index([listingId])
}
```

Add to Listing model: `links ListingLink[]`

## Code generation
- Alphabet: `abcdefghjkmnpqrstuvwxyz23456789` (32 chars, no 0/o/1/l/i)
- 4 chars = 32^4 = ~1M combinations, plenty for 100K codes (10K listings × 10)
- Generate random, retry on collision (collision rate < 0.01% at 100K codes)

## Auto-create on listing creation
- When a listing is created (POST /api/listings), generate 10 codes immediately
- Code #1 gets label "default", codes #2-10 get labels "campaign-2" through "campaign-10"
- Admin can rename labels later

## Backend routes

**1. Redirect route in `app.ts`** (before SPA catch-all):
```
GET /work/:code → lookup ListingLink by code → increment clicks → 302 redirect to /listings/:listingId?ref=:code
```

Also inject OG meta tags (same as `/listings/:id`) so the short link previews correctly on social.

**2. Admin API** (in listings.ts or new file):
```
GET  /api/listings/:id/links        → return all 10 links with click counts
PUT  /api/listings/:id/links/:code  → update label (admin only)
```

## Frontend

**1. New route in App.tsx**: NOT needed — the redirect happens server-side before the SPA loads.

**2. ListingDetail.tsx**: Pass `ref` query param into analytics events so we can trace which link code drove signups.

**3. Admin panel**: Add a "Links" tab/section to AdminListingDetailPage showing the 10 codes with labels, click counts, and copy buttons.

## Tracking flow
1. User clicks `humanpages.ai/work/ab3k`
2. Server: `ListingLink.clicks++`, redirect to `/listings/cmmhgk...?ref=ab3k`
3. Frontend: `listing_viewed` event includes `ref=ab3k`
4. On signup: `ref` param saved to sessionStorage, passed through to signup analytics
5. Admin sees: code → clicks → signups → applications per code

## Migration
- One migration: add `ListingLink` table
- Backfill script: generate 10 codes for each existing listing

## Files to touch
1. `backend/prisma/schema.prisma` — add ListingLink model
2. `backend/prisma/migrations/xxx/` — new migration
3. `backend/src/routes/listings.ts` — auto-create 10 links on listing creation, admin endpoints
4. `backend/src/app.ts` — add `/work/:code` redirect + OG meta injection
5. `frontend/src/pages/ListingDetail.tsx` — read `ref` param into analytics
6. `frontend/src/pages/admin/AdminListingDetailPage.tsx` — links management UI
7. Backfill script for existing listings
