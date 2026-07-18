# STATUS — Reader

Last updated: 2026-07-18

## Current objective

Keep Reader available for direct personal use. No roadmap expansion. Accept
only maintenance, reliability, or personally requested workflow fixes.
(Closure decision 2026-07-10.)

## Active work

- **Documentation consolidation** (2026-07-18): built a maintainable,
  local-first `docs/` knowledge system with a Blume presentation layer,
  link/structure validator, and CI. AGENTS.md slimmed to a bootloader;
  STATUS.md introduced; pre-Vite docs archived with historical markers. See
  `docs/index.md`.

## Recent shipped

- **2026-07-13** — Authenticated RSS/Atom reader with OPML import, direct
  feed add/remove, bounded manual refresh, unread/read inbox state, and
  save-to-library. Migration `drizzle/0002_first_green_goblin.sql` is
  additive and applied to production.
- **2026-07-03** — Memory capture promoted from prototype to persisted,
  authenticated flow (`memories` table, `/api/memories` CRUD + search,
  `/memory` UI, browser-memory import).
- **2026-07-02** — `api.onError()` global error handler + outer try/catch in
  the Worker fetch handler; React `<ErrorBoundary>` wrapping
  `RouterProvider` in `bootstrap.tsx`.
- **Wave 2 migration** — De-OpenNext migration to Vite + React 19 SPA +
  Hono Worker. Worker name `reader` preserved. See
  `docs/architecture/decisions/0001-vite-spa-hono-worker.md`.

## Blockers

- (none)

## Unresolved questions / deferred

- **Drop legacy NextAuth tables** (`account`, `session`, `verificationToken`
  in `src/lib/db/schema.ts`) once confirmed no active rows. See
  `docs/architecture/decisions/0004-better-auth-google.md`.
- **Switch `drizzle-kit push` → `drizzle-kit generate`** for safer schema
  changes as user count grows. See
  `docs/operations/runbooks/migrate-schema.md`.
- **Re-enable better-auth rate limiting** if the app becomes public.
  Currently disabled (`rateLimit: { enabled: false }`).
- **RSS background refresh via Cloudflare scheduled triggers** — deferred
  until manual use demonstrates the need. See
  `docs/architecture/decisions/0008-rss-inbox.md`.
- **Rate limiting on AI/snapshot/proxy endpoints** — deferred pending
  endpoint-specific abuse evidence. See
  `docs/knowledge/failed-approaches.md`.
- **Explicit CORS on share routes** — deferred until cross-origin access is
  needed.
- **Browser-extension distribution** — deferred until web import and capture
  flow are reliable.
- **PDF storage representation** — paused at the current documented
  representation; reopen only for a concrete storage defect.
- **README still describes pre-migration Next.js layout in places** —
  canonical runtime is Vite SPA + Hono worker. (Low priority; AGENTS.md and
  docs/ are current.)

## Next steps

1. Land the documentation consolidation branch
   (`docs/consolidate-knowledge-system`) for human review.
2. Wire `pnpm docs:check` into CI (`.github/workflows/docs.yml`) and confirm
   it runs green on the next push.
3. Optionally publish the Blume docs site for Reader (one of the "few core
   projects" — confirm with the operator before deploying).

## Pointers

- Product context, features, surfaces: [`docs/product/`](docs/product/)
- Architecture + ADRs: [`docs/architecture/`](docs/architecture/)
- Operations + runbooks: [`docs/operations/`](docs/operations/)
- Historical PROJECT_STATUS.md (pre-consolidation, 2026-07-13):
  [`PROJECT_STATUS.md`](PROJECT_STATUS.md) — kept as a pointer for fleet
  tooling that reads it by name.
