# External References — Reader

One entry per concept. "What / why for this project / link."

---

## Deployment

**OpenNext for Cloudflare**  
Adapter that compiles Next.js App Router apps into Cloudflare Workers.
Central to how this project deploys; explains the build pipeline, asset
binding, and server-function model that motivate the two patch scripts.  
→ https://opennext.js.org/cloudflare

**Cloudflare Workers — Next.js guide**  
Official CF guide for running Next.js on Workers; covers `nodejs_compat_v2`,
smart placement, and known incompatibilities.  
→ https://developers.cloudflare.com/workers/frameworks/framework-guides/nextjs/

**Cloudflare Smart Placement**  
Routes a Worker to the CF PoP closest to the external service it calls most
(Turso in this case). Directly addresses the TTFB problem flagged in `wrangler.toml`.  
→ https://developers.cloudflare.com/workers/configuration/smart-placement/

---

## Database

**Turso (libSQL) docs**  
Managed SQLite-compatible edge database. The libSQL client, connection
strings, and auth token setup are all here.  
→ https://docs.turso.tech/

**Drizzle ORM docs**  
ORM used for schema definition, queries, and migrations. Covers `drizzle-kit push`
vs `generate` — the choice that matters for production schema safety.  
→ https://orm.drizzle.team/docs/overview

**`@libsql/client` — Node.js vs workerd targets**  
Explains the `node.mjs` / `web.mjs` split that drives L1 and L2 in `lessons.md`.  
→ https://github.com/tursodatabase/libsql-client-ts

---

## Auth

**better-auth docs**  
Auth library used for Google OAuth + session management. Covers Drizzle
adapter, CF Workers environment quirks, and the `readRuntimeEnv` pattern.  
→ https://www.better-auth.com/docs

---

## AI

**Vercel AI SDK reference**  
`streamText`, `toTextStreamResponse`, and provider configuration. The
`@ai-sdk/openai-compatible` package enables the gateway+BYOK pattern.  
→ https://sdk.vercel.ai/docs

**Cloudflare Workers AI**  
Free-tier model catalogue (10 k Neurons/day), including `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
which is the default model in `ai-cloudflare.ts`.  
→ https://developers.cloudflare.com/workers-ai/

---

## Extension

**Chrome MV3 Side Panel API**  
Covers `sidePanel` permission, `chrome.sidePanel.open()`, and lifecycle
differences vs popup. Required reading for L16-L18 in `lessons.md`.  
→ https://developer.chrome.com/docs/extensions/reference/api/sidePanel

**MV3 Service Worker lifecycle**  
Explains why session cookies don't work from extension origins and why
long-lived API keys (ADR-06) are the right auth approach for the extension.  
→ https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers

---

## Content Extraction

**Mozilla Readability**  
The DOM-based article extraction library used in `/api/snapshot`. Documents
what makes a page parseable and common failure modes (SPA pages with no
initial HTML content).  
→ https://github.com/mozilla/readability

**pdfjs-dist**  
PDF rendering engine used in `PDFReaderClient.tsx`. The `GlobalWorkerOptions.workerSrc`
configuration and local worker loading are covered in the Getting Started guide.  
→ https://mozilla.github.io/pdf.js/

**linkedom**  
Lightweight DOM parser used server-side instead of JSDOM or Playwright.
Explains why it's faster and more Workers-compatible.  
→ https://github.com/WebReflection/linkedom

---

## Storage

**Cloudflare R2 — Workers binding**  
How `PDFS_BUCKET` binding works (`put`, `get`, `delete`), zero-egress pricing,
and the difference from the S3-compatible HTTP API used before the Paid plan.  
→ https://developers.cloudflare.com/r2/api/workers/workers-api-usage/
