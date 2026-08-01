# ADR-0002: Turso (libSQL) via Drizzle ORM

**Date:** 2026-04-25 (Firebase → Turso migration); carried forward post-Vite migration
**Status:** Superseded by [ADR-0010](0010-cloudflare-d1.md); retained as migration history.
**Supersedes:** [archive/decisions.md ADR-02](../../archive/decisions.md) (same decision; this record updates the runtime context to Vite + Hono)

## Context

The original data layer was Firebase Firestore (NoSQL, deny-all rules, O(n)
full-table scan for search, no real SQL). The migration plan is preserved in
[archive/plans-migrate-off-firebase.md](../../archive/plans-migrate-off-firebase.md)
and the retro in
[archive/retro-firebase-to-cloudflare-2026-04-25.md](../../archive/retro-firebase-to-cloudflare-2026-04-25.md).

## Decision

Use Turso (managed libSQL/SQLite) via Drizzle ORM.

- Schema lives in `src/lib/db/schema.ts`; a lazy client proxy in
  `src/lib/db/client.ts` defers `@libsql/client/web` instantiation until first
  use so the Worker can bind its env first.
- Schema sync via `drizzle-kit push` (`pnpm db:push`). Migration SQL files are
  also kept under `drizzle/` (`0000_baseline.sql`, `0001_memories.sql`,
  `0002_first_green_goblin.sql` for RSS).
- JSON columns (`tags`, `notes`, `aiChat`, `summary`, `keyPoints`,
  `pdfMetadata`, `sessionReview`) are stored as text and typed via
  `$type<T>()` for TS safety. No row-level JSON filtering in current query
  patterns.
- `better-auth` uses its first-party Drizzle adapter on the same DB.

## Rationale

- libSQL is SQLite-compatible → portable, easy to reason about, queryable with
  SQL.
- Drizzle adapter for better-auth exists natively.
- Turso + Workers `placement.mode = "smart"` co-locate the Worker with the
  Turso primary, eliminating cross-region RTT on every request (the
  pre-Smart-Placement TTFB was the dominant LCP contributor — see
  [knowledge/learnings.md](../../knowledge/learnings.md)).
- External access from `drizzle-kit` and `tsx` scripts (migration scripts,
  studio) works because Turso is reachable over HTTP, unlike Cloudflare D1
  which is Workers-only.

## Tradeoffs

- `drizzle-kit push` is schema-sync, not migration history. Safe for a
  single-user DB; fragile if a push runs against production with data in an
  incompatible old shape. Mitigation: additive migrations are committed under
  `drizzle/` and applied deliberately; see
  [operations/runbooks/migrate-schema.md](../../operations/runbooks/migrate-schema.md).
- The legacy NextAuth tables (`account`, `session`, `verificationToken`) remain
  in schema as dead weight from the Auth.js → better-auth swap. Safe to drop
  after manual verification (open question, tracked in STATUS).

## Alternatives considered

- **Cloudflare D1:** SQLite-compatible but no external access from
  `drizzle-kit studio` or migration scripts.
- **Postgres (Neon/Supabase):** more powerful but heavier; `pg` driver has
  Workers compat friction; not needed at single-user scale.
- **Keep Firestore:** rejected — O(n) search, no real SQL, deny-all rules.

## Open questions

- When to switch from `drizzle-kit push` to `drizzle-kit generate` for safer
  schema changes as user count grows. Tracked in STATUS.md.
