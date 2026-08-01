# Architecture Overview

Reader is a Vite + React 19 single-page application served from a Hono Worker
on Cloudflare Workers. No SSR, no Next.js. The browser loads `app.html` (one
Vite entry) and routes client-side via `react-router-dom`; the Worker handles
`/api/*` and serves built assets via the `ASSETS` binding.

## Shape

```
                ┌──────────────────────── Cloudflare Worker (reader) ────────────────────────┐
                │                                                                          │
  browser ──────► src/worker.ts                                                             │
                │   ├── handleAgentEdge(request)   ← /llms.txt, /index.md, /api/ai, …        │
                │   ├── api.fetch()              ← Hono router under /api/*                  │
                │   │     ├── /api/auth/*        ← better-auth (Google OAuth, Drizzle)       │
                │   │     ├── /api/articles      ← articles.ts                              │
                │   │     ├── /api/boards        ← boards.ts                                │
                │   │     ├── /api/lists         ← lists.ts                                 │
                │   │     ├── /api/memories      ← memories.ts                              │
                │   │     ├── /api/ai            ← ai.ts (chat / summarize / models)        │
                │   │     ├── /api/keys          ← keys.ts (rdr_* API keys)                 │
                │   │     ├── /api/pdfs          ← pdf.ts (R2-backed)                       │
                │   │     ├── /api/rss           ← rss.ts (feeds + entries + OPML)          │
                │   │     ├── /api/share         ← share.ts (public share)                  │
                │   │     └── /api/*             ← misc.ts (search, tags, snapshot, proxy,  │
                │   │                                    data-export, ext chat, browser-mem)│
                │   └── env.ASSETS.fetch()       ← built SPA + landing (dist/)              │
                │                                                                          │
                │   Bindings: DB (D1), PDFS_BUCKET (R2), ASSETS (dist/)                     │
                └────────────────────────────────┬─────────────────────────────────────────┘
                                                 │
                  ┌──────────────────────────────┼──────────────────────────────┐
                  ▼                              ▼                              ▼
            Cloudflare D1               Cloudflare R2                free-ai-gateway
            via Drizzle ORM             reader-pdfs bucket            (AI_BASE_URL)
            (articles, boards,          (PDF binaries,               + BYOK providers
            lists, memories, rss,       proxied downloads)           + local-ai (dev)
            api_keys, better-auth)
```

## Key files

- `src/worker.ts` — Hono Worker entry. Security headers, `/api/*` routing,
  asset serving, SPA fallback, agent-edge handler.
- `src/worker/routes/*.ts` — one Hono router per resource; mounted under
  `/api/<resource>`.
- `src/lib/db/schema.ts` — Drizzle schema (app tables + better-auth tables +
  legacy NextAuth tables kept for reference).
- `src/lib/db/client.ts` — D1 Drizzle client. Lazy proxy so the client is
  not created at module load (required for the Workers runtime).
- `src/lib/auth.ts` — better-auth server config (`createAuth`), Drizzle
  adapter, Google OAuth, `oneTap` plugin, rate limiting disabled.
- `src/lib/auth-api.ts` — `getAuthenticatedUserId()` resolves either a
  `Bearer rdr_*` API key (extension) or a better-auth session cookie (web).
- `src/lib/storage.ts` — R2 helpers for `PDFS_BUCKET`.
- `src/lib/ai-cloudflare.ts` — builds a `LanguageModel` from an OpenAI-compatible
  endpoint, routed through the free-ai gateway with `x-gateway-project-id: reader`.
- `src/lib/url-validation.ts` + `src/lib/safe-fetch.ts` — SSRF protection and
  redirect-safe fetch used by snapshot/proxy/RSS refresh.
- `src/router.tsx` — client-side routes (lazy-loaded pages).
- `wrangler.toml` — Worker config: `main = src/worker.ts`, `DB` + `ASSETS` + `PDFS_BUCKET`
  bindings, `placement.mode = "smart"`, `nodejs_compat_v2`, custom domain.
- `vite.config.ts` — Vite SPA build (React, Tailwind v4, Lightning CSS).
- `app.html` — single SPA HTML entry (Vite input; carries inline shell CSS).

## Build & deploy pipeline

```
pnpm deploy
  → validate:env:deploy          (scripts/validate-env.mjs)
  → cf:build
      → pnpm build               (validate env + vite build → dist/)
      → pnpm --filter ./landing-astro build
      → node scripts/overlay-astro-landing.mjs   (overlay landing → dist/)
  → wrangler deploy              (Worker + ASSETS binding serves dist/)
```

The landing page (`landing-astro/`) is an **overlay**, not a separate product.
It overwrites `dist/index.html` and merges `_headers`; the SPA lives at
`dist/app.html` and is served at `/app`. SPA fallback uses
`not_found_handling = single-page-application` semantics via the Worker's
explicit fallback to `/app`.

## Decisions

The why behind this shape is in [decisions/](decisions/). Start with
[0001-vite-spa-hono-worker.md](decisions/0001-vite-spa-hono-worker.md) for the
migration off Next.js + OpenNext.

## Data flow

See [data-flow.md](data-flow.md) for the request lifecycle, auth resolution,
storage paths, and AI routing.
