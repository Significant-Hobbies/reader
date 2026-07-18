# Architecture Decision Records — Reader (pre-Vite, historical)

> **Historical record.** These ADRs were authored while Reader ran on
> Next.js + OpenNext on Cloudflare Workers. The app has since migrated to a
> Vite + React 19 SPA backed by a Hono Worker (see
> [`docs/architecture/decisions/`](../architecture/decisions/) for current
> ADRs). This file is preserved verbatim for context and git history.
> ADR-01 (Next.js + OpenNext) is **superseded** by the Vite/Hono migration;
> ADR-02 through ADR-07 largely still apply but reference the old runtime in
> places. Read with the migration in mind.

Decisions are listed in rough chronological order. Rationale is drawn from
code comments, plan docs, and git history. Unknown rationale is flagged
`TBD: capture rationale`.

---

## ADR-01: Next.js 16 on Cloudflare Workers via OpenNext

**Date:** 2025-11-16 (initial commit); OpenNext deployment adopted ~2026-03

**Context.** The app is a server-rendered Next.js app with App Router, RSC,
and API routes. Hosting options were Vercel (native), Cloudflare Pages, and
Cloudflare Workers via `@opennextjs/cloudflare`.

**Decision.** Deploy as a Cloudflare Worker using `@opennextjs/cloudflare`
(`opennextjs-cloudflare` v1.19). A brief detour to Cloudflare Pages was
tried on 2026-04-25 and reverted the same day.

**Rationale.**

- R2 and Workers AI bindings (native, zero-cost) only exist in the Workers
  runtime — Pages Functions can access bindings but lose the full Worker
  lifecycle needed by OpenNext's server-function approach.
- Workers AI free tier (10 k Neurons/day) is accessible only from Workers.
- `smart placement` co-locates the Worker with Turso to eliminate
  cross-region RTT on every server component render (see `wrangler.toml`).
- Existing Cloudflare account; no Vercel billing.

**Alternatives considered.**

- Vercel: simpler DX, but adds a vendor for what Cloudflare already covers.
- Cloudflare Pages: tried on 2026-04-25; reverted same day — R2 native binding
  friction and OpenNext Pages adapter was less mature than the Workers adapter.
- Standalone Node.js (`next start`): no edge performance, no R2/AI bindings.

**Tradeoffs.**

- Build requires two manual patch scripts (`scripts/patch-opennext.mjs` pre +
  post, `scripts/fix-opennext-deps.mjs`) to work around OpenNext limitations —
  see ADR-07 for details.
- `ignoreBuildErrors: true` in `next.config.ts` was needed to avoid build
  timeouts; type-checking runs separately via `tsc --noEmit`.
- Workers size limit and `nodejs_compat_v2` flag required for libSQL.

---

## ADR-02: Turso (libSQL) via Drizzle ORM

**Date:** 2026-04-25 (Firebase→Turso migration landed)

**Context.** The original data layer was Firebase Firestore (NoSQL, no real
SQL, O(n) full-table scan for search). The `plans/migrate-off-firebase.md`
plan documents the full rationale.

**Decision.** Replace Firestore with Turso (libSQL/SQLite-compatible managed
DB) using Drizzle ORM with `drizzle-kit push` (schema-sync, no migration files).

**Rationale.**

- Firestore gave "~zero value beyond storage + Auth integration" — no
  real-time, no offline, deny-all rules, and O(n) search (direct quote from
  plan doc).
- libSQL is SQLite-compatible, making it portable and easy to reason about.
- Drizzle adapter for `better-auth` exists natively; Auth.js libSQL adapter
  was the original target (plan doc) but `better-auth` was chosen instead.
- Turso `smart placement` + Cloudflare Workers `smart placement` in
  `wrangler.toml` minimises cross-region latency.
- Schema stores JSON blobs (`tags`, `notes`, `aiChat`, `summary`) as text
  columns with `$type<T>()` for TS safety — no row-level JSON filtering
  needed in current query patterns.

**Alternatives considered.**

- Cloudflare D1: SQLite-compatible but no external access from
  non-Workers contexts (e.g. `drizzle-kit studio`, migration scripts).
- Postgres (Neon/Supabase): more powerful but heavier; not needed at this
  scale, and would require `pg` driver which has CF Workers compat issues.
- Keep Firestore: rejected — search cost and no real SQL.
- Vercel Blob + Vercel Postgres: plan doc originally proposed Vercel Blob
  for storage, but that path was abandoned when the deploy moved off Vercel.

**Tradeoffs.**

- `drizzle-kit push` is schema-sync (no migration history). Safe for single
  user; fragile if schema changes go wrong in production.
- `@libsql/isomorphic-ws` requires the `nodejs_compat_v2` Workers flag and
  the two OpenNext patch scripts to resolve `web.mjs` vs `node.mjs` at
  bundle time — see ADR-07.
- Schema carries both `better-auth` tables (`ba_session`, `ba_account`,
  `ba_verification`) and unused legacy NextAuth tables (`session`, `account`,
  `verificationToken`) left over from the migration to avoid a destructive
  drop.

---

## ADR-03: Cloudflare R2 for PDF Storage

**Date:** 2026-04-25 (migrated from GCS/Firebase Storage; native binding
adopted 2026-04-27)

**Context.** PDFs were stored in Google Cloud Storage via Firebase Admin
(signed URLs). After Firebase teardown a replacement was needed.

**Decision.** Cloudflare R2 bucket (`reader-pdfs`) bound as `PDFS_BUCKET`
in `wrangler.toml`. Access is always proxied through
`/api/pdfs/[id]/download` — clients never receive the raw R2 URL.

**Rationale.**

- Native Workers R2 binding: zero egress cost, no S3-SDK bundle weight.
- Auth and ownership enforced server-side on every download (prevents IDOR).
- R2 accessed via `getCloudflareContext().env.PDFS_BUCKET` — no HTTP calls,
  just a Workers binding object.
- `@aws-sdk` S3-compatible client was used briefly (2026-04-25) then replaced
  with the native binding once the Paid plan unlocked the binding (2026-04-27,
  commit `6a702be`).

**Alternatives considered.**

- Vercel Blob: plan doc listed this; abandoned when deploy moved off Vercel.
- Cloudflare KV: not suited for large binary blobs.
- Cloudflare Durable Objects: over-engineered for object storage.
- Keep GCS: requires `firebase-admin` which was being removed.

**Tradeoffs.**

- PDF URLs use a `blob://<storageKey>` sentinel as the article `url` field
  to avoid collisions with real HTTP URLs.
- R2 binding is not available in `next dev`; local dev requires R2
  env-var credentials with the S3-compatible API endpoint.
- 10 MB per-file limit enforced in `pdf-service.ts`; magic-byte PDF
  validation added to reject spoofed MIME types.

---

## ADR-04: AI SDK + Free-AI-Gateway Pattern (BYOK Design)

**Date:** 2026-02-13 (AI SDK integrated); gateway pattern formalised
~2026-04-27

**Context.** The app needs LLM chat and summarisation. Three paths exist:
call provider APIs directly, proxy through a self-hosted gateway, or use
the Workers AI binding.

**Decision.** All server-side AI calls go through `free-ai-gateway`
(`https://free-ai-gateway.sarthakagrawal927.workers.dev/v1`) — a single
Workers AI chokepoint that enforces a 9500 Neuron/day hard cap across the
entire fleet. Client-side BYOK: users supply their own OpenAI/Anthropic/Gemini
API key, which the browser sends per-request; the server proxies it directly
to the provider and never persists it. A local AI dev path (`scripts/local-ai.mjs`)
bridges a local LLM for zero-cost development.

**Rationale.**

- Single budget chokepoint across all fleet projects: the gateway owns the
  daily Neuron budget so no single project can exhaust it.
- BYOK keys are stored in the browser only — aligns with the security note
  in README ("API keys stored in browser only"). Zero server-side key storage
  risk.
- `@ai-sdk/openai-compatible` allows any OpenAI-compatible endpoint
  (Workers AI, OpenAI, Anthropic via OpenAI-compat, Gemini) without
  provider-specific SDKs.
- Vercel AI SDK `streamText` + `toTextStreamResponse` handles streaming
  uniformly across all providers.

**Alternatives considered.**

- Direct provider SDKs: multiple deps, no unified streaming, no budget
  control.
- Workers AI binding directly: only works on Cloudflare; no dev path and
  no multi-provider support.
- Self-hosted OpenAI proxy (LiteLLM etc.): operational overhead.

**Tradeoffs.**

- BYOK means users must have their own API keys for non-free models.
- Extension AI chat (`/api/ext/chat`) uses the same gateway pattern,
  authenticated via hashed API keys stored in the `api_keys` table.
- Local AI path is intentionally dev-only (`isLocalCLIEnabled()` gated by
  `NODE_ENV`).

---

## ADR-05: better-auth (Google OAuth via Drizzle Adapter)

**Date:** 2026-04-25 (replaced Firebase Auth); 2026-04-25 also a brief
detour via Auth.js v5 (plan doc target) then settled on better-auth.

**Context.** Firebase Auth was removed as part of ADR-02. A replacement auth
library compatible with Turso/libSQL was needed.

**Decision.** `better-auth` v1.6 with its Drizzle adapter, Google OAuth only.
Auth secrets are read from both `process.env` and the Cloudflare Workers
runtime via `getCloudflareContext()` to handle the split between Next.js
build-time env and Workers runtime secrets (`wrangler secret put`).

**Rationale.**

- `better-auth` has a first-party Drizzle adapter; Auth.js v5 libSQL adapter
  was the original plan-doc choice but `better-auth` was favoured at cutover.
- `readRuntimeEnv()` dual-read pattern in `src/lib/auth.ts` is required
  because CF Workers secrets are not available as `process.env` at
  request time in the `nodejs_compat_v2` runtime — they're in `env`.
- Rate limiting disabled (`rateLimit: { enabled: false }`) — TBD: capture
  rationale (likely single-user scale, avoid false positives).

**Alternatives considered.**

- Auth.js (NextAuth) v5: original plan, but `better-auth` chosen at cutover.
  Legacy NextAuth tables remain in schema as dead weight.
- Firebase Auth: removed — whole point of the migration.
- Clerk / Auth0: third-party managed; adds cost and external dependency.

**Tradeoffs.**

- Legacy NextAuth tables (`account`, `session`, `verificationToken`) remain
  in Drizzle schema as unused remnants; safe to drop after manual verification.
- `BETTER_AUTH_SECRET` must be set as a Wrangler secret; build fallback
  uses a hardcoded dev string to avoid blocking `next build`.

---

## ADR-06: MV3 Side Panel (not popup) for Extension UI

**Date:** 2026-04-04 (extension scaffolded with side panel from the start)

**Context.** The Chrome extension needs a UI surface for chat and save
actions. MV3 offers popup (ephemeral, closes on blur) and side panel
(persistent, stays open while browsing).

**Decision.** Side panel (`sidePanel` permission, `side_panel.default_path`)
as the primary UI. A popup (`action.default_popup`) is also present for
quick actions (Save to Library / Import & Read CTAs).

**Rationale.**

- Side panel persists while the user navigates; essential for reading/chatting
  across page loads.
- Popup is fine for one-click capture but closes as soon as the user clicks
  elsewhere — not usable for extended AI chat sessions.
- TBD: capture rationale for why both side-panel and popup coexist (rather
  than side-panel only).

**Alternatives considered.**

- Popup-only: simpler, but closes on blur — no persistent chat UX.
- Full-page extension tab: loses connection to the current browsing context.

**Tradeoffs.**

- Side panel requires `sidePanel` permission (Chrome 114+); limits to
  Chromium-based browsers.
- Both surfaces share the same content-script (`@mozilla/readability` runs
  in content-script.ts) but have separate React app entry points.
- Extension auth uses hashed API keys (`api_keys` table + `/api/ext/chat`)
  rather than session cookies — required because side-panel requests are
  cross-origin to the deployed Worker URL.

---

## ADR-07: Content Extraction Stack (Readability + linkedom server-side; pdfjs client-side)

**Date:** 2026-02-13 (`linkedom` adopted replacing Playwright); pdfjs added
2026-02-14

**Context.** Articles are captured server-side from a URL; PDFs are uploaded
and must be viewable with text extraction.

**Decision.**

- HTML extraction: `@mozilla/readability` + `linkedom` (fast, headless DOM
  parser) in the `/api/snapshot` route on the server.
- PDF viewing: `pdfjs-dist` + `react-pdf` on the client.
- PDF text extraction: `pdf-parse` on the server at upload time.
- pdfjs web worker loaded from `public/pdf.worker.min.mjs` (local) — see
  commit `381355e`.

**Rationale.**

- Readability is the reference implementation of the Mercury/Readability
  algorithm; produces clean article content.
- `linkedom` replaced Playwright for server-side DOM parsing (Playwright
  was too heavy/slow for a Workers runtime; `linkedom` is pure JS).
- pdfjs-dist is the canonical PDF renderer for web; no viable pure-JS
  alternative.
- Web worker loaded locally (not from CDN) to satisfy the extension's
  strict CSP (`script-src 'self'`) and avoid sandboxed CF Workers blocking
  remote script fetches.

**Alternatives considered.**

- Playwright / Puppeteer: requires a full browser process; not viable in
  Workers runtime; was used briefly before `linkedom`.
- JSDOM: heavier than `linkedom`; more node-specific APIs.
- PDF.co / external PDF API: adds cost and external dependency.

**Tradeoffs.**

- Readability fails on heavily JS-rendered pages (SPAs) — the server-side
  fetch only captures the initial HTML. TBD: capture if a JS-rendering
  fallback was considered.
- 10 MB max PDF size enforced at upload.
- pdfjs worker path must be explicitly set and served from `/public` to
  avoid CF Workers runtime errors and CSP violations.

---

## ADR-08: JSON Blobs for Relational-Lite Data (notes, aiChat, tags)

**Date:** 2026-04-25 (schema design; carried from Firestore-era structure)

**Context.** Notes, AI chat history, tags, and key points are per-article
data that are always read/written as complete arrays alongside the article row.

**Decision.** Store as JSON text columns in the `articles` table using
Drizzle `$type<T>()` for compile-time safety.

**Rationale.** Avoids join queries for the most common access pattern
(load article + all its notes/chat). Firestore stored these as subcollections;
the SQLite equivalent is embedding them as JSON given there's no row-level
filtering needed. SQLite's `json_each` is available if filtering is ever
needed (noted in plan doc).

**Tradeoffs.** No per-note or per-message indexed queries; full array
rewrite on every update. Acceptable at single-user scale.
