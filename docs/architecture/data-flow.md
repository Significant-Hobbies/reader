# Data Flow

How a request moves through the system. Read alongside
[overview.md](overview.md) for the shape.

## Worker entry (`src/worker.ts`)

```
request → export default { fetch }
  1. handleAgentEdge(request)            ← /llms.txt, /llms-full.txt, /index.md, /api/ai, /robots.txt
       returns early if matched
  2. if pathname.startsWith('/api/') → api.fetch(request, env, ctx)
       Hono router; onError → 500 JSON; outer try/catch → 500 JSON
  3. if GET / and has auth cookie → 302 /library
  4. env.ASSETS.fetch(request)           ← static assets + SPA
       if ok → withSecurityHeaders(response)
  5. if GET / → serve /index.html (landing overlay)
  6. fallback → serve /app (SPA)         ← SPA fallback for client-side routes
```

`bindWorkerEnv(c.env)` runs on every `/api/*` request so module-level singletons
(the lazy `db` proxy, `pdfsBucket`) can resolve the runtime env.

## Auth resolution (`src/lib/auth-api.ts`)

`getAuthenticatedUserId(headers, env)` is called at the top of every protected
route handler. Priority:

1. **`Authorization: Bearer rdr_*`** — long-lived API key (Chrome extension).
   `verifyApiKey()` hashes the token, looks it up in `api_keys` where
   `revoked_at IS NULL`, bumps `last_used_at`, returns the owning `userId`.
   The plaintext token is shown once at creation and never persisted.
2. **better-auth session cookie** — webapp users. `createAuth(env).api.getSession()`
   reads the `session_token` / `session-token` cookie and resolves the user.

`requireSessionUserId()` is the cookie-only variant for routes that must not
accept API keys (e.g. key management itself).

## Database (`src/lib/db/`)

- `createDb(env)` builds a Drizzle instance over `@libsql/client/web` using
  `TURSO_DATABASE_URL` (rewritten `libsql://` → `https://`) and
  `TURSO_AUTH_TOKEN`.
- A module-level `db` Proxy defers client creation until first property access
  (`getDb()`), so the Worker can `bindWorkerEnv()` before any query runs.
- All reads/writes are scoped by `userId` from the auth step. JSON columns
  (`tags`, `notes`, `aiChat`, `summary`, `keyPoints`, `pdfMetadata`,
  `sessionReview`) are stored as text and typed via `$type<T>()`.

### Tables

- `user`, `ba_session`, `ba_account`, `ba_verification` — better-auth.
- `account`, `session`, `verificationToken` — legacy NextAuth tables kept for
  reference, not used by better-auth. Safe to drop after manual verification
  (see [knowledge/learnings.md](../knowledge/learnings.md)).
- `articles` — core; `type` ∈ `article | link | pdf`; `pdfStorageKey` for R2.
- `boards`, `lists` — grouping.
- `memories` — browser-memory captures; `(user_id, url)` unique.
- `rss_feeds`, `rss_entries` — RSS subscriptions + entries; `(user_id, feed_url)`
  unique; `(feed_id, external_id)` unique.
- `api_keys` — `rdr_*` tokens; `token_hash` unique; `revoked_at` nullable.

Migrations live in `drizzle/` (`0000_baseline.sql`, `0001_memories.sql`,
`0002_first_green_goblin.sql` for RSS). Schema sync uses `drizzle-kit push`
(`pnpm db:push`); see [operations/runbooks/migrate-schema.md](../operations/runbooks/migrate-schema.md).

## PDF storage (`src/lib/storage.ts` + `src/worker/routes/pdf.ts`)

- Upload: `POST /api/pdfs/upload` (multipart) → validate size (10 MB) →
  validate magic bytes (`%PDF-`) → `PDFS_BUCKET.put('pdfs/<userId>/<uuid>.pdf')`
  → store `blob://<storageKey>` as `articles.url` → optional `pdf-parse` text
  extraction → return article record.
- Download: `GET /api/pdfs/:id/download` → auth + ownership check →
  `PDFS_BUCKET.get(storageKey)` → stream bytes with `application/pdf` content
  type. Clients never receive a raw R2 URL.
- The R2 binding is unavailable in `next dev`-style local dev; the binding is
  set via `bindWorkerEnv()` from `wrangler dev` / production.

## AI routing (`src/lib/ai-cloudflare.ts` + `src/worker/routes/ai.ts`)

- `getLanguageModel()` builds an `@ai-sdk/openai-compatible` provider pointing
  at `AI_BASE_URL` (default `https://ai-gateway.sassmaker.com/v1`) with the
  `x-gateway-project-id: reader` header. The gateway enforces a 9500 Neuron/day
  fleet-wide cap.
- Default model: `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (Workers AI).
- BYOK: when the client sends an `Authorization: Bearer <provider-key>` that is
  not a `rdr_*` key, the route uses the user-supplied endpoint/key/model
  directly. BYOK keys are normalised (`normalizeApiKey`, length-capped) and
  never persisted or logged.
- Local AI: `isLocalCLIEnabled()` is `NODE_ENV === 'development'` only.
  `createLocalAITextStream()` bridges `LOCAL_AI_URL` (default
  `http://127.0.0.1:3456`) via Server-Sent Events.
- `POST /api/ai/chat` streams text (`streamText` + `toTextStreamResponse`).
- `POST /api/ai/summarize` generates a summary + 3–5 key points
  (`generateText`).
- `POST /api/ai/models` proxies `/models` on the configured endpoint.

## Server-side URL fetches (SSRF boundary)

`/api/snapshot`, `/api/proxy`, and RSS refresh all funnel through:

1. `validateExternalUrl(url)` (`src/lib/url-validation.ts`) — rejects
   non-HTTP(S), localhost, RFC1918, link-local, cloud metadata (169.254.169.254),
   decimal/hex-encoded IPs. Resolves DNS once (note: not a full DNS-rebinding
   defence — appropriate for a personal-use reader; see the file's comment).
2. `fetchWithValidatedRedirects(url)` (`src/lib/safe-fetch.ts`) — follows
   redirects manually, re-validating every `Location` before the next hop
   (max 5). Prevents a public URL bouncing the server into a private target
   after the first request.

RSS refresh adds: 15 s per-feed timeout, bounded concurrency (4), response-size
cap (`MAX_FEED_BYTES`), entry cap, and per-feed error isolation.

## Extension auth path

The Chrome extension cannot share the same-origin session cookie (its requests
originate from the extension's origin). Flow:

1. User creates an API key in the webapp (`POST /api/keys`) → `generateApiKey()`
   returns `rdr_<32 chars>` plaintext once; `token_hash` + `prefix` persisted.
2. Extension stores the plaintext in `chrome.storage` and sends it as
   `Authorization: Bearer rdr_...` on every request.
3. `getAuthenticatedUserId()` resolves the bearer path before the cookie path.
4. Extension AI chat uses `/api/ext/chat` (`src/worker/routes/misc.ts`), which
   also accepts the bearer key and reuses the same gateway/BYOK logic.

## Caching

- `caches.default` (Cloudflare edge cache) is used in `articles-db.ts` for
  article reads (5 min TTL), guarded by `globalThis.caches?.default` because it
  is unavailable in `next dev`-style local dev. Cache must be explicitly busted
  on writes (see `lists-db.ts`).
- Security headers set `Cache-Control: public, max-age=300, s-maxage=600,
  stale-while-revalidate=86400` on `text/html` responses so deploys propagate
  quickly without sacrificing TTFB.
- `/api/auth/client-config` is sent with `Cache-Control: no-store`.
