# Failed Approaches — Reader

Approaches tried and abandoned, with reasons. Each entry links to the
archived material where relevant. Preserved so the same path is not retried
without a new reason.

## Next.js + OpenNext on Cloudflare Workers (superseded 2026-05)

**What:** Server-rendered Next.js App Router deployed to Cloudflare Workers
via `@opennextjs/cloudflare`.

**Why abandoned:** Required two bespoke patch scripts
(`scripts/patch-opennext.mjs` pre + post, `scripts/fix-opennext-deps.mjs`)
to work around `@libsql/isomorphic-ws` `node.mjs` vs `web.mjs` resolution and
`WeakRef` / `FinalizationRegistry` not being free globals under
`nodejs_compat_v2`. `next build` needed `ignoreBuildErrors: true` to avoid
timeouts, pushing type-checking out of the build pipeline. For a personal-use,
client-heavy reading app with no SSR requirement, the OpenNext layer was pure
operational cost.

**What replaced it:** Vite + React 19 SPA + Hono Worker. See
[architecture/decisions/0001-vite-spa-hono-worker.md](../architecture/decisions/0001-vite-spa-hono-worker.md)
and the pre-Vite ADRs in [archive/decisions.md](../archive/decisions.md).

**Do not retry unless:** SSR becomes a product requirement (e.g. public SEO on
auth-walled routes — currently not needed; the landing is Astro and the app is
auth-walled).

## Cloudflare Pages (same-day revert, 2026-04-25)

**What:** Migrated the deploy from Cloudflare Workers to Cloudflare Pages for
a clean `*.pages.dev` URL.

**Why abandoned:** Native R2 and Workers AI bindings behave differently under
the Pages Functions model with OpenNext, and the Workers adapter was more
mature. Reverted the same day (commit `434559e` → `6358c03`, ~2h55m). The
`.cf-pages-bundle` entry in `.gitignore` is a leftover from this experiment.

**What replaced it:** Stayed on Workers. The custom domain
`read.significanthobbies.com` is bound to the Worker.

**Do not retry unless:** Pages gains first-class R2 binding parity and a
mature Hono/Vite adapter story.

## Firebase (Firestore + Auth + GCS) (removed 2026-04-25)

**What:** Original data layer — Firestore (NoSQL), Firebase Auth, GCS via
Firebase Admin for PDF storage.

**Why abandoned:** Firestore gave "~zero value beyond storage + Auth
integration" — no real-time, no offline, deny-all rules, and O(n) full-table
scan for search. Three Firebase services (Firestore + Auth + GCS) replaced by
Turso (1) + better-auth (reuses Turso) + R2 (native binding).

**What replaced it:** Turso (libSQL) via Drizzle ORM, better-auth + Google
OAuth, Cloudflare R2. See
[architecture/decisions/0002-turso-drizzle.md](../architecture/decisions/0002-turso-drizzle.md),
[0003-r2-pdfs.md](../architecture/decisions/0003-r2-pdfs.md),
[0004-better-auth-google.md](../architecture/decisions/0004-better-auth-google.md).

**Do not retry unless:** A use case emerges that needs Firestore's offline
sync or realtime subscriptions at scale — not the case for a personal reader.

## Auth.js v5 (NextAuth) — brief detour (2026-04-25)

**What:** The migration plan targeted `next-auth@beta` (Auth.js v5) with the
libSQL adapter.

**Why abandoned:** At cutover `better-auth` was chosen because of its
first-party Drizzle adapter. The legacy NextAuth tables (`account`,
`session`, `verificationToken`) remain in `src/lib/db/schema.ts` as dead
weight.

**What replaced it:** better-auth v1.6 with the Drizzle adapter, Google OAuth
only, `oneTap` plugin.

**Do not retry unless:** better-auth loses maintenance or a feature Auth.js
uniquely provides becomes required.

## `@aws-sdk/client-s3` for R2 (replaced 2026-04-27)

**What:** Initially accessed R2 via the S3-compatible `@aws-sdk/client-s3`
with explicit credentials.

**Why abandoned:** After upgrading to the Cloudflare Paid plan, the native
`PDFS_BUCKET` Workers binding became available — zero HTTP overhead, no
egress cost, no SDK bundle weight. `@aws-sdk` is fully absent from
`package.json` now.

**What replaced it:** `getCloudflareContext().env.PDFS_BUCKET` /
`setPdfBucket(env.PDFS_BUCKET)` in `src/lib/storage.ts`.

**Do not retry unless:** R2 access is needed from outside the Workers runtime
(local scripts, non-Workers services) — the S3-compat API is still the right
path there.

## Playwright for server-side DOM parsing (replaced 2026-02-13)

**What:** Used Playwright to render and parse pages for article extraction.

**Why abandoned:** Requires a full browser process; not viable in the
Cloudflare Workers runtime. Too heavy and slow.

**What replaced it:** `linkedom` (pure-JS DOM parser) + `@mozilla/readability`.
See [architecture/decisions/0007-content-extraction.md](../architecture/decisions/0007-content-extraction.md).

**Do not retry unless:** Extraction needs JavaScript-rendered content that
`linkedom` cannot parse — at which point a separate browser-service worker
(not the request-handling Worker) would be required.

## RSS background refresh via Cloudflare scheduled triggers (deferred)

**What:** Scheduled triggers (`[triggers] crons` in `wrangler.toml`) for
automatic RSS refresh.

**Why deferred:** Manual refresh is predictable and sufficient for the
personal-use MVP. Scheduled refresh introduces operational behaviour
(trigger management, failure handling, cost) beyond the requested in-app
reader.

**What is in place instead:** Manual `POST /api/rss/refresh` with bounded
concurrency and per-feed error isolation. See
[architecture/decisions/0008-rss-inbox.md](../architecture/decisions/0008-rss-inbox.md).

**Reopen when:** manual use demonstrates the need for background refresh.

## Rate limiting on AI/snapshot/proxy endpoints (deferred)

**What:** Cloudflare rate limiting on potentially abusable endpoints.

**Why deferred:** No endpoint-specific abuse evidence. Prefer ownership
checks, input validation, and cost controls first; only add rate limiting
for a specific abused endpoint with explicit approval.

**What is in place instead:** Auth + ownership on every protected route; SSRF
validation on URL-fetching routes; 10 MB PDF size cap; bounded RSS refresh
concurrency; free-ai gateway 9500 Neuron/day fleet cap.

**Reopen when:** a specific endpoint shows abuse in observability
(`[observability] enabled = true` in `wrangler.toml`).

## Explicit CORS configuration (deferred)

**What:** Explicit CORS headers on share / API routes.

**Why deferred:** The app is same-origin today; share routes return JSON
consumed same-origin. External URLs are proxied server-side via `/api/proxy`.

**Reopen when:** share routes need cross-origin access (e.g. embedding in a
third-party site).
