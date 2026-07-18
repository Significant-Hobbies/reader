# Migrate off Firebase to Turso + Auth.js + Vercel Blob

**Date:** 2026-04-24
**Status:** Draft (awaiting review)
**Branch:** `migrate-off-firebase`
**Goal:** Kill Firebase entirely. Replace with Turso (libSQL) + Auth.js v5 (Google) + Vercel Blob. Path B from the consolidation discussion.

---

## Why

- Firebase gives ~zero value here beyond storage + Auth integration (see investigation: no real-time, no offline, deny-all rules, search is O(n) full-table scan).
- Consolidates services: removes Firebase entirely (Firestore + Auth + GCS = 3 services → 0). Adds Turso (1) + reuses Vercel Blob under the existing Vercel account.
- Unlocks a real search path (SQL `LIKE` or FTS5), fixing the current quadratic search cost.

## Non-goals

- No new features.
- No UI changes beyond what auth swap forces.
- No restructuring of component tree.

---

## Stack after migration

| Layer | Before | After |
|---|---|---|
| DB | Firestore (NoSQL) | Turso (libSQL / SQLite) via Drizzle ORM |
| Auth | Firebase Auth + session cookie | Auth.js v5 + Google provider, libSQL adapter |
| PDF storage | GCS via Firebase Admin | Vercel Blob |
| Session verify | `firebase-admin` | `auth()` from Auth.js |
| Chrome ext auth | Firebase ID token bearer | Auth.js session token bearer |

---

## Schema (SQLite via Drizzle)

```ts
// users, accounts, sessions, verificationTokens — per Auth.js libSQL adapter defaults

articles: {
  id: text primary key,            // uuid, not autoincrement
  userId: text not null references users(id),
  url: text not null,
  title: text not null,
  content: text,                   // sanitized HTML
  byline: text,
  siteName: text,
  tags: text,                      // JSON array
  listIds: text,                   // JSON array
  notes: text,                     // JSON array of Note
  aiChat: text,                    // JSON array of messages
  summary: text,                   // JSON object (short/medium/long)
  keyPoints: text,                 // JSON array
  status: text default 'in_progress',
  readingTimeMinutes: integer,
  shareId: text unique,
  isShared: integer default 0,
  pdfStorageKey: text,             // Vercel Blob key (replaces GCS path)
  createdAt: integer not null,
  updatedAt: integer not null,
}
// Indexes: (userId, createdAt desc), (userId, url), (shareId)

boards: {
  id: text primary key,
  userId: text not null references users(id),
  name: text not null,
  nodes: text,                     // JSON
  edges: text,                     // JSON
  shareId: text unique,
  isShared: integer default 0,
  createdAt: integer,
  updatedAt: integer,
}

lists: {
  id: text primary key,
  userId: text not null references users(id),
  name: text not null,
  createdAt: integer,
}
```

**Design notes:**
- JSON columns (`tags`, `listIds`, `notes`, `aiChat`) — these are read/written as blobs, no row-level filtering needed. SQLite's `json_each` available if we ever need it.
- `projectId` column dropped entirely — already deprecated in favor of `listIds`.
- `annotations` legacy collection name not carried over — table is just `articles`.
- Timestamps as integer millis (Unix epoch) — cleanest with Drizzle + libSQL.

---

## Phases

### Phase 0 — Prep (done / doing)
- [x] Feature branch `migrate-off-firebase`
- [x] Provision Turso DB (`reader`, group `default`)
- [x] Env vars appended to `.env.local`, placeholders in `.env.example`
- [ ] Vercel Blob setup → blocked on CLI install or dashboard click (see Blockers)
- [ ] Google OAuth client (user will handle at the end per their call)

### Phase 1 — Schema + DB layer (no cutover)
- Add deps: `drizzle-orm`, `drizzle-kit`, `@libsql/client`, `next-auth@beta` (v5), `@auth/drizzle-adapter`, `@vercel/blob`
- `src/lib/db/schema.ts` — Drizzle schema
- `src/lib/db/client.ts` — libSQL client singleton
- `drizzle.config.ts` — push config
- `pnpm db:push` script — applies schema to Turso

### Phase 2 — Service layer (parallel to Firestore, not wired)
- `src/lib/articles-db.ts` — new, mirrors `articles-service.ts` surface, hits Turso
- `src/lib/boards-db.ts` — same
- `src/lib/lists-db.ts` — same
- Each exposes identical function names + shapes so route swap is mechanical

### Phase 3 — Auth.js swap
- `src/lib/auth.ts` — `NextAuth(...)` config with Google + Drizzle adapter
- `src/app/api/auth/[...nextauth]/route.ts` — Auth.js handlers
- Replace `getAuthenticatedUserId()` in `src/lib/auth-api.ts` with `auth()` session read
- `src/components/AuthProvider.tsx` — swap Firebase client SDK for `SessionProvider`
- `src/components/LoginClient.tsx` — swap `signInWithGoogle` → `signIn('google')`
- Delete `src/app/api/auth/session/route.ts` (Auth.js owns it now)

### Phase 4 — Storage swap
- `src/app/api/pdf/upload/route.ts` — Vercel Blob `put()` instead of GCS
- `src/app/api/pdfs/[id]/route.ts` (or wherever signed URLs are generated) — Vercel Blob URLs (public-by-default with unguessable paths) OR signed URLs if sensitivity matters
- Update `pdf-service.ts`

### Phase 5 — Chrome extension auth
- `packages/chrome-extension` — swap Firebase Auth for Auth.js session bearer flow
- Keep the extension buildable against both during transition
- User-visible change: one re-login after cutover

### Phase 6 — Route cutover (flag-gated)
- Add `USE_TURSO=true` in `.env.local`
- Each API route: `if (USE_TURSO) import from '*-db' else from '*-service'`
- Verify every route end-to-end in dev before flipping default

### Phase 7 — Data migration
- `scripts/migrate-firestore-to-turso.ts`
  - Read from Firestore Admin SDK with existing creds
  - Transform each doc → SQL row
  - Insert via Drizzle, batch of 100
  - Dry-run flag first; prints counts, no writes
  - Idempotent (upsert by id)
- Rollback path: keep Firestore as-is. To roll back, just flip `USE_TURSO=false`.

### Phase 8 — Cutover
- Run migration for real
- Manual smoke test: login, save article, save PDF, read article, edit notes, run AI chat, create board, search
- Flip default to Turso in code (remove flag)
- Announce: 1-week Firebase-kept window

### Phase 9 — Tear down Firebase (+1 week after cutover, no issues)
- Delete `src/lib/firebase.ts`, `firebase-admin.ts`, `articles-service.ts`, `boards-service.ts`, `lists-service.ts`
- Remove `firebase`, `firebase-admin` deps
- Delete `firebase.json`, `firestore.rules`, `firestore.indexes.json`, `firebase-service-account.json`
- Remove Firebase env vars from Vercel + `.env.example`
- Delete GCS PDF bucket (after verifying all PDFs are in Blob)
- Archive this plan → `plans/archive/2026-MM-DD-migrate-off-firebase.md`

---

## Blockers (user-supplied)

1. **Vercel Blob token** — either `npm i -g vercel` + `vercel link` + `vercel blob store add reader-pdfs` (I'll run it), or create via dashboard (Project → Storage → Blob → Connect) and paste token into `.env.local` as `BLOB_READ_WRITE_TOKEN`.
2. **Google OAuth** — user handles at the end per their call. Either reuse Firebase GCP project's OAuth client (add redirect URI `http://localhost:3000/api/auth/callback/google` and prod URL) or create new. `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` → `.env.local`.

## Risks

- **Data loss during migration.** Mitigation: Firestore stays intact, migration is additive, rollback = flag flip. Do the real migration right before cutover so source data doesn't drift.
- **Auth cutover invalidates existing sessions.** Acceptable — one re-login. User is the only real user.
- **Vercel Blob public URLs.** If we use public URLs with unguessable paths, that's less secure than GCS signed URLs. Decide per Phase 4.
- **Chrome extension bearer token UX** — Auth.js doesn't emit a JWT bearer by default; may need a custom `/api/ext/token` route. Will resolve in Phase 5.
- **Drizzle migration churn** — first schema, not worried. Subsequent schema changes use `drizzle-kit push` (no migration files) or `drizzle-kit generate` (migration files). Choose in Phase 1.

## Open questions (decide before coding)

1. Drizzle `push` (schema-sync, no migration files, simpler) vs `generate` (tracked migration files, safer for schema drift). Recommend `push` initially since you're the only user; switch to `generate` once stable.
2. Vercel Blob public URLs vs signed URLs for PDFs?
3. Delete `annotations` legacy naming, rename table to `articles` in the new schema — any concern?
4. Should the chrome extension get its own API key (long-lived) instead of a session bearer, to survive re-logins?
