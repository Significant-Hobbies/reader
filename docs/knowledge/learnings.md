# Engineering Lessons — Reader (current)

Concrete lessons evidenced by current code, scripts, or git history. Each
links to the decision record where relevant. Pre-Vite lessons (OpenNext
patch scripts, `next.config.ts`, `WeakRef` patches, etc.) are preserved in
[archive/lessons.md](../archive/lessons.md) — they describe
code that no longer exists but capture useful failure modes.

## Worker / runtime

### L1: Bind the Worker env before any module-level singleton touches it

`src/worker.ts` runs `bindWorkerEnv(c.env)` on every `/api/*` request so the
lazy `db` proxy (`src/lib/db/client.ts`) and the `pdfsBucket` singleton
(`src/lib/storage.ts`) resolve the runtime env before first use. Eager
instantiation at module load fails in the Workers runtime where the env is
not yet available at import time.

→ [architecture/decisions/0002-turso-drizzle.md](../architecture/decisions/0002-turso-drizzle.md),
   [architecture/decisions/0003-r2-pdfs.md](../architecture/decisions/0003-r2-pdfs.md)

### L2: `caches.default` is unavailable in pure-Vite dev

`articles-db.ts` caches article reads at the edge (5 min TTL) using
`globalThis.caches?.default`. The guard is required because `caches.default`
does not exist in some local-dev runtimes (e.g. the pure-Vite SPA dev server).
Cache must be explicitly busted on writes (see `lists-db.ts`).

### L3: Smart Placement is essential for Turso latency

`wrangler.toml` has `[placement] mode = "smart"`. Without it, the Worker runs
in a Cloudflare PoP that may be far from the Turso primary, paying a
cross-region RTT on every request. A psi-swarm audit flagged TTFB >1s as the
dominant LCP contributor before Smart Placement was enabled.

→ [architecture/decisions/0002-turso-drizzle.md](../architecture/decisions/0002-turso-drizzle.md)

### L4: `run_worker_first` is required for agent surfaces and `/api/*`

`wrangler.toml` sets `run_worker_first` for `/sitemap.xml`, `/index.md`,
`/llms-full.txt`, `/llms.txt`, `/api/*`, and `/`. Without it, the `ASSETS`
binding serves static files first and the Worker never sees the agent-edge
or API paths.

→ [product/surfaces.md](../product/surfaces.md)

## Database / Drizzle

### L5: `drizzle-kit push` is schema-sync, not migration history

`pnpm db:push` diffs `schema.ts` against the live DB and applies the diff.
Safe for a single-user DB; fragile if a push runs against production with
data in an incompatible old shape. Additive migrations are committed under
`drizzle/` and applied deliberately. Open question: switch to
`drizzle-kit generate` as user count grows (tracked in STATUS.md).

→ [operations/runbooks/migrate-schema.md](../operations/runbooks/migrate-schema.md)

### L6: Legacy NextAuth tables are dead weight

`src/lib/db/schema.ts` still defines `account`, `session`, `verificationToken`
(leftover from the Auth.js → better-auth swap). They are unused by
better-auth. Safe to drop after confirming no active rows. Open question,
tracked in STATUS.md.

→ [architecture/decisions/0004-better-auth-google.md](../architecture/decisions/0004-better-auth-google.md)

### L7: JSON columns are text + `$type<T>()`

`tags`, `notes`, `aiChat`, `summary`, `keyPoints`, `pdfMetadata`,
`sessionReview` are stored as text and typed via `$type<T>()` for TS safety.
No row-level JSON filtering in current query patterns; `json_each` is
available if needed.

## R2 / PDFs

### L8: PDF MIME must be validated by magic bytes

`src/lib/pdf-service.ts` and the upload route do not trust `file.type`
(browser-controlled and spoofable). Read the first 5 bytes and check for
`%PDF-` before accepting the file.

→ [architecture/decisions/0003-r2-pdfs.md](../architecture/decisions/0003-r2-pdfs.md)

### L9: `blob://` sentinel URL prevents article dedup collision

PDFs don't have an HTTP URL. The upload stores `blob://<storageKey>` as the
`articles.url` field so the `(user_id, url)` unique index does not collide
with real HTTP article URLs.

## AI / gateway / BYOK

### L10: BYOK keys must never be persisted server-side

BYOK provider keys are sent per-request from the client and used immediately
— never written to the database or logs. `normalizeApiKey()` in
`ai-server.ts` trims and length-limits the key before use. Extension AI
calls use hashed long-lived `rdr_*` API keys instead.

→ [architecture/decisions/0005-ai-gateway-byok.md](../architecture/decisions/0005-ai-gateway-byok.md)

### L11: `x-gateway-project-id: reader` header is required for fleet budget attribution

All AI requests include `x-gateway-project-id: reader`. Without it the
free-ai gateway cannot distinguish Reader from other fleet projects and
cannot attribute the 9500 Neuron/day fleet-wide cap.

## MV3 extension

### L12: pdfjs web worker must be loaded locally

pdfjs-dist defaults to loading its web worker from a CDN. This fails
in the extension context (CSP `script-src 'self'` blocks remote scripts)
and in the CF Workers build sandbox. In the webapp, `src/components/PDFViewer.tsx`
sets `GlobalWorkerOptions.workerSrc` to
`new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`, so Vite
bundles the worker locally into `dist/assets/` instead of fetching it remotely.

→ [architecture/decisions/0007-content-extraction.md](../architecture/decisions/0007-content-extraction.md)

### L13: Extension auth uses hashed API keys, not session cookies

MV3 extensions cannot share the same-origin session cookie. The `api_keys`
table stores SHA-256-hashed tokens (`sha256Hex` in `src/lib/api-keys.ts`) with
a visible `rdr_` prefix. The extension
sends the raw token as a Bearer header; the server hashes it for lookup.

→ [architecture/decisions/0006-mv3-side-panel.md](../architecture/decisions/0006-mv3-side-panel.md)

## Security

### L14: All server-side URL fetches funnel through SSRF validation

`/api/snapshot`, `/api/proxy`, and RSS refresh use
`validateExternalUrl()` (`src/lib/url-validation.ts`) +
`fetchWithValidatedRedirects()` (`src/lib/safe-fetch.ts`). The latter
re-validates every redirect target before following it, so a public URL
cannot bounce the server into a private network hop after the first request.

DNS rebinding note: validation resolves DNS once, but `fetch` may re-resolve
later. Full protection would require a custom fetch agent that pins the
resolved IP (not available in the Workers fetch API). Appropriate for a
personal-use reader; revisit if the server becomes privileged.

→ [architecture/data-flow.md](../architecture/data-flow.md),
   [archive/security-audit-2026-03-29.md](../archive/security-audit-2026-03-29.md)

### L15: HTML is sanitised at ingestion AND on read

Content is sanitised before storage and re-sanitised in
`fetchArticleById()` / `fetchArticleByShareId()` for defence-in-depth. Do
not remove the read-time sanitisation even though ingestion sanitises — it
guards against a future ingestion bypass or stale data.

→ [archive/security-audit-2026-03-29.md](../archive/security-audit-2026-03-29.md)

## Build / deploy

### L16: `pnpm cf:build` overlays the landing; the SPA lives at `/app`

`scripts/overlay-astro-landing.mjs` copies `landing-astro/dist/*` over
`dist/` except for protected prefixes (`assets/`, `app.html`). `_headers` is
merged. The SPA is served at `/app`; the landing at `/`. SPA fallback for
unknown paths goes to `/app` (handled in `src/worker.ts`).

→ [operations/deploy.md](../operations/deploy.md)

### L17: The Worker name `reader` is load-bearing

The Worker is named `reader` in `wrangler.toml`. The custom domain
(`read.significanthobbies.com`) and all Cloudflare secrets are bound to that
name. Do not rename it without re-provisioning secrets and the route.

→ [architecture/decisions/0001-vite-spa-hono-worker.md](../architecture/decisions/0001-vite-spa-hono-worker.md)
