# Engineering Lessons — Reader (pre-Vite, historical)

> **Historical record.** These lessons were captured while Reader ran on
> Next.js + `@opennextjs/cloudflare`. The app has since migrated to a Vite +
> React 19 SPA with a Hono Worker, so the OpenNext-specific lessons
> (`scripts/patch-opennext.mjs`, `next.config.ts`, `WeakRef` patches,
> `serverExternalPackages`, etc.) describe code that no longer exists in the
> repo. They are preserved verbatim because the underlying failure modes and
> reasoning are still useful context. Current, applicable lessons live in
> [`docs/knowledge/learnings.md`](../knowledge/learnings.md).

Concrete lessons evidenced by code, scripts, or git history. Each links to
the decision record where relevant.

---

## OpenNext / Cloudflare Workers

### L1: libSQL requires two separate OpenNext patch scripts

`@libsql/isomorphic-ws` ships `node.mjs` for Node.js and `web.mjs` for
browser/workerd environments. Next.js NFT file tracing follows the `node`
condition and copies `node.mjs`. OpenNext's esbuild then runs with the
`workerd` condition, resolving to `web.mjs` — which was never traced/copied.
**Two scripts are required:**

1. `scripts/patch-opennext.mjs` (pre-build): injects an esbuild alias
   `@libsql/isomorphic-ws → web.mjs` into OpenNext's `bundle-server.js`
   before the Next.js build runs.
2. `scripts/fix-opennext-deps.mjs` (post-build): copies `web.mjs` and
   `web.cjs` from the pnpm store into the `.open-next` output tree because
   pnpm's trace-based copy still misses them.

See `cf:build` script in `package.json` for the ordering:
`patch-opennext.mjs → next build → opennextjs-cloudflare build → patch-opennext.mjs --post`.

→ ADR-01, ADR-02

### L2: `WeakRef` and `FinalizationRegistry` are not free globals in `nodejs_compat_v2`

`nodejs_compat_v2` does not expose `WeakRef` / `FinalizationRegistry` as bare
globals inside webpack CJS module factories. The post-build patch
(`patch-opennext.mjs --post`) rewrites all `{WeakRef,FinalizationRegistry}`
destructuring to `{WeakRef:globalThis.WeakRef,...}` in the bundled
`handler.mjs`, and injects a polyfill at the top of `worker.js` so
`globalThis.WeakRef` is defined before the handler loads.

→ ADR-01

### L3: Cloudflare Workers secrets are not `process.env` at request time

When using `nodejs_compat_v2`, secrets set via `wrangler secret put` appear
in `env` (the Workers bindings object) rather than `process.env` during
request handling. `src/lib/auth.ts` implements a `readRuntimeEnv()` helper
that tries `process.env` first (build time / local dev) then falls back to
`getCloudflareContext({ async: false }).env` for runtime secrets.

→ ADR-05

### L4: Cloudflare Pages was a dead end (same day revert)

On 2026-04-25, the deploy was migrated to Cloudflare Pages for a clean
`*.pages.dev` URL (commit `434559e`). The same day it was reverted back to
Workers (commit `6358c03`) because native R2 and Workers AI bindings behave
differently under the Pages Functions model with OpenNext, and the Workers
adapter was more mature. The `workers.dev` URL is used in production.

→ ADR-01, ADR-03

### L5: Font fetches are sandboxed during CF Workers build

Remote Google Fonts (`fonts.googleapis.com`) requests are blocked in the
CF Workers build sandbox. The fix (commit `f47ebf3`) was to serve fonts
locally from `/public` and reference them via CSS `@font-face` rather than
the Next.js `next/font/google` loader with CDN fetches.

→ ADR-01

### L6: Smart Placement is essential for Turso latency

Without `placement.mode = "smart"` in `wrangler.toml`, the Worker runs in a
CF PoP that may be far from the Turso primary replica. psi-swarm flagged TTFB

> 1s as the dominant LCP contributor before Smart Placement was enabled
> (commit `6e76720`, `wrangler.toml` comment). With smart placement, the Worker
> co-locates with Turso to avoid cross-region RTT on every server component.

→ ADR-02

### L7: `typescript.ignoreBuildErrors: true` was necessary to avoid build timeouts

Type-checking during `next build` caused timeouts in the CF Workers build
pipeline. `next.config.ts` disables it; a separate `pnpm type-check`
(`tsc --noEmit`) step handles type validation outside the build.

---

## Turso / libSQL / Drizzle

### L8: libSQL client must be in `serverExternalPackages`

`@libsql/client`, `@libsql/hrana-client`, `@libsql/isomorphic-ws`,
`drizzle-orm`, and `@auth/drizzle-adapter` must all be listed in
`next.config.ts` `serverExternalPackages` so webpack does not bundle them —
the libSQL WebSocket transport breaks when bundled.

### L9: Turso client initialisation must be lazy

Commit `ba9500e` ("fix(db): defer Turso client init via lazy proxy") shows
that eagerly instantiating the libSQL client at module import time causes
failures in the CF Workers environment where the binding/env is not yet
available. A lazy proxy pattern defers client creation until first use.

### L10: `drizzle-kit push` vs `generate` — choose early

The plan doc noted: use `push` initially (no migration files, simpler);
switch to `generate` once stable. The repo currently uses `push` only
(`pnpm db:push`). This is fine for a single-user database but will become
a liability if the user count grows or if a push is run against production
while data exists in the old schema shape.

---

## R2 / PDF Storage

### L11: Native R2 binding replaced @aws-sdk after Paid plan unlock

Initially R2 was accessed via the S3-compatible `@aws-sdk/client-s3` with
explicit credentials. After upgrading to the Cloudflare Paid plan (commit
`6a702be`, 2026-04-27), the native `PDFS_BUCKET` Workers binding became
available — zero HTTP overhead, no egress cost, no SDK bundle weight.
The `getCloudflareContext().env.PDFS_BUCKET` pattern in `storage.ts` is only
available in the Workers runtime; local dev must still use env-var credentials.

### L12: PDF MIME type must be validated server-side via magic bytes

The upload route (`/api/pdf/upload/route.ts`) explicitly notes: "Do not trust
`file.type` — it is browser-controlled and easily spoofed." It reads the first
5 bytes and checks for the `%PDF-` magic number before accepting the file.

### L13: `blob://` sentinel URL prevents article dedup collision

PDFs don't have an HTTP URL. The upload stores `blob://<storageKey>` as the
`articles.url` field. This prevents the user-URL uniqueness index
(`articles_user_url_idx`) from colliding with real HTTP article URLs.

---

## AI / Gateway / BYOK

### L14: BYOK keys must never be persisted server-side

BYOK provider keys (OpenAI, Anthropic, Gemini) are sent per-request from the
client and used immediately — they are never written to the database or logs.
The `normalizeApiKey()` helper in `ai-server.ts` strips and length-limits
the key before use. Extension AI calls use hashed long-lived API keys stored
in the `api_keys` table instead.

### L15: Gateway `x-gateway-project-id` header enables per-project budget tracking

All AI requests include `x-gateway-project-id: reader` in the header. The
`free-ai-gateway` Worker uses this to attribute Neuron spend per project and
enforce the 9500/day fleet-wide cap. Without this header the gateway cannot
distinguish Reader from other fleet projects.

---

## MV3 Extension

### L16: pdfjs web worker must be loaded locally, not from CDN

pdfjs-dist defaults to loading its web worker from `unpkg.com` (CDN). This
was failing in the CF Workers build environment and in the extension context
(CSP `script-src 'self'` blocks remote scripts). Commit `381355e` fixed the
path to load `pdf.worker.min.mjs` from `/public` (served as a local static
asset) via explicit `GlobalWorkerOptions.workerSrc` configuration.

### L17: Extension auth uses hashed API keys, not session cookies

MV3 extensions cannot share the same-origin session cookie with the web app
because extension requests originate from the extension's origin, not
`reader.*.workers.dev`. The `api_keys` table stores HMAC-hashed tokens with
a visible prefix (`rdr_...`). The extension sends the raw token as a Bearer
header; the server hashes it for lookup. This avoids the complexities of
OAuth token refresh from a service worker context.

→ ADR-06

### L18: Both side-panel and popup exist for different action modes

The popup handles ephemeral one-click actions (Save to Library, Import &
Read). The side panel handles persistent chat sessions. The content script
(`@mozilla/readability`) runs in the page context and is triggered by both
surfaces via Chrome messaging.

→ ADR-06
