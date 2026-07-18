# New things to learn — reader

Technologies encountered during reader development that are worth understanding in depth.
See also: [external-references.md](./learning-pre-vite-external-references.md)

---

## OpenNext (`@opennextjs/cloudflare`)

- What: Adapter that runs a Next.js App Router app as a Cloudflare Worker
- Why here: TBD
- Gotcha (from code): One dual-mode script (`scripts/patch-opennext.mjs`) runs twice per deploy — pre-build aliases `@libsql/isomorphic-ws → web.mjs` in `bundle-server.js`, post-build (`--post`) patches `WeakRef/FinalizationRegistry` references in `handler.mjs` and injects a polyfill into `worker.js`; both passes are wired into `cf:build` (`package.json:13`). A second script `scripts/fix-opennext-deps.mjs` copies `web.mjs/web.cjs` into `.open-next` but is not in the current `cf:build` pipeline — it exists as an alternative fallback.
- Source: https://opennext.js.org/cloudflare

## Turso / libSQL

- What: Managed SQLite-compatible database with HTTP + WebSocket transport
- Why here: TBD
- Gotcha (from code): Client must be initialised lazily (not at module load time) and listed in `serverExternalPackages` — eager init or bundling breaks the WebSocket transport in the Workers runtime. Confirmed: `next.config.ts:6-11` lists `@libsql/client`, `@libsql/hrana-client`, and `@libsql/isomorphic-ws`.
- Source: https://docs.turso.tech

## Drizzle ORM

- What: TypeScript ORM with a `drizzle-kit push` schema-sync workflow (no migration files)
- Why here: TBD
- Gotcha (from code): Schema lives entirely in `src/lib/db/schema.ts`; no migration files exist — `drizzle-kit push` diffs the live DB directly. This means rollbacks require manual SQL.
- Source: https://orm.drizzle.team

## Cloudflare R2 (native Workers binding)

- What: S3-compatible object storage with a zero-cost native Workers binding
- Why here: TBD
- Gotcha (from code): `@aws-sdk` S3 client was replaced with `getCloudflareContext().env.PDFS_BUCKET` at the Paid-plan unlock (commit `6a702be`). `@aws-sdk` is fully absent from `package.json`. Native binding accessed via `src/lib/storage.ts:24`; unavailable on the free plan or in `next dev`.
- Source: https://developers.cloudflare.com/r2/

## Vercel AI SDK + BYOK gateway pattern

- What: `@ai-sdk/openai-compatible` + `streamText` for provider-agnostic LLM streaming; BYOK = user-supplied key sent per-request, never persisted
- Why here: TBD
- Source: https://sdk.vercel.ai/docs

## better-auth

- What: Auth library with first-party Drizzle adapter; replaces NextAuth/Auth.js
- Why here: TBD
- Gotcha (from code): Orphaned NextAuth tables (`account`, `session`, `verificationToken`) remain in `src/lib/db/schema.ts:63-105` with comment "kept for reference, not used by better-auth" — safe to drop only after confirming no active rows.
- Source: https://www.better-auth.com

## Chrome MV3 Side Panel

- What: Persistent Chrome extension UI surface (`sidePanel` permission, Chrome 114+) that stays open while the user browses
- Why here: TBD
- Gotcha (from code): Extension requests are cross-origin to the Workers URL so session cookies can't be shared — auth uses SHA-256-hashed API keys with `rdr_` prefix (`src/lib/api-keys.ts:10-11`). Only the hash is persisted; plaintext is shown once at creation (`src/app/api/keys/route.ts:52`). Extension validates prefix client-side (`packages/chrome-extension/src/side-panel/components/PageHeader.tsx`).
- Source: https://developer.chrome.com/docs/extensions/reference/api/sidePanel

## Mozilla Readability + linkedom

- What: Reference Readability algorithm for article extraction; `linkedom` is a lightweight server-side DOM parser that replaced Playwright
- Why here: TBD
- Source: https://github.com/mozilla/readability

## pdfjs-dist

- What: Mozilla's canonical PDF renderer for the web, runs in a web worker
- Why here: TBD
- Gotcha (from code): Worker must be loaded from `/public` (local static asset) — CDN fetch is blocked by the extension's `script-src 'self'` CSP and CF Workers build sandbox
- Source: https://mozilla.github.io/pdf.js/

## Cloudflare Workers Smart Placement

- What: CF feature that automatically routes a Worker to the datacenter closest to its backend services (DB, KV, etc.) rather than the user
- Why here: TBD
- Gotcha (from code): Enabled via `placement = { mode = "smart" }` in `wrangler.toml:10-11` after a psi-swarm audit flagged TTFB >1s as the LCP bottleneck — server components were paying a cross-region RTT to Turso on every request.
- Source: https://developers.cloudflare.com/workers/configuration/smart-placement/

## Cloudflare Workers Edge Cache (`caches.default`)

- What: Workers-native `caches.default` Cache API for server-side response caching without a CDN layer
- Why here: TBD
- Gotcha (from code): Used in `src/lib/articles-db.ts:424` to cache article reads at the edge (5 min TTL). Not available in `next dev` — guarded by `globalThis.caches?.default`. Cache must be explicitly busted on article writes (see `lists-db.ts`).
- Source: https://developers.cloudflare.com/workers/runtime-apis/cache/

## Cloudflare Pages (brief experiment)

- What: CF's static + Functions hosting, alternative to Workers for Next.js
- Why here: TBD
- Gotcha (from code): Tried and reverted the same day (2026-04-25 18:19→21:14 IST, commits `434559e`→`6358c03`, ~2h55m) — R2 native binding friction and the Workers OpenNext adapter was more mature. Pages experiment confirmed by `.cf-pages-bundle` in `.gitignore` (commit `e2fe901`).
- Source: https://developers.cloudflare.com/pages/
