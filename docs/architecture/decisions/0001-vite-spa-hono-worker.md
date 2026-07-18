# ADR-0001: Vite + React 19 SPA + Hono Worker (migrate off Next.js + OpenNext)

**Date:** ~2026-05 (Wave 2 migration landed; Worker name `reader` preserved)
**Status:** Current
**Supersedes:** [archive/decisions.md ADR-01](../../archive/decisions.md) (Next.js 16 on Cloudflare Workers via OpenNext)

## Context

Reader originally ran as a server-rendered Next.js App Router app deployed to
Cloudflare Workers via `@opennextjs/cloudflare`. That stack required two bespoke
patch scripts (`scripts/patch-opennext.mjs` pre + post, `scripts/fix-opennext-deps.mjs`)
to work around `@libsql/isomorphic-ws` `node.mjs` vs `web.mjs` resolution and
`WeakRef` / `FinalizationRegistry` not being free globals under
`nodejs_compat_v2`. `next build` also needed `ignoreBuildErrors: true` to avoid
timeouts, pushing type-checking out of the build pipeline.

For a personal-use, client-heavy reading app with no SSR requirement, the
OpenNext layer was pure operational cost.

## Decision

Migrate to a Vite + React 19 single-page application backed by a Hono Worker.

- **Single Vite entry:** `app.html` is the only HTML input; the browser loads
  it and routes client-side via `react-router-dom`.
- **Hono Worker:** `src/worker.ts` mounts `/api/*` route modules and serves
  built assets via the `ASSETS` binding. No SSR, no RSC, no Next.js.
- **Worker name preserved:** the Cloudflare Worker is still named `reader` so
  the custom domain and secrets carry over without re-provisioning.
- **TypeScript split:** `tsconfig.app.json` (SPA) and `tsconfig.worker.json`
  (Worker + server libs) are referenced by `tsconfig.json`; `pnpm typecheck`
  runs `tsc --noEmit` against both.
- **Build pipeline:** `vite build` → `dist/`; `cf:build` overlays the Astro
  landing onto `dist/index.html` and merges `_headers`; `wrangler deploy`
  serves `dist/` via `ASSETS`.
- **SPA fallback:** the Worker explicitly falls back to `/app` for unmatched
  GETs so client-side routes work on cold loads.

## Rationale

- Removes the OpenNext patch scripts and the `ignoreBuildErrors` workaround —
  type-checking now runs in CI and locally via `pnpm typecheck`.
- Vite dev server is faster than Next dev for an SPA-only workload.
- Hono is a tiny, idiomatic Workers router; route modules under
  `src/worker/routes/` map 1:1 to resources.
- The `ASSETS` binding + `run_worker_first` for `/api/*`, `/`, sitemap, and
  agent surfaces gives the Worker first-touch on the routes that need it
  without paying for SSR on every request.

## Tradeoffs

- No SSR / no streaming RSC — not acceptable for content-driven sites that need
  SEO on protected routes, but Reader's public surface is the landing page
  (Astro) plus agent-indexing surfaces (`llms.txt`, `index.md`, `api/ai`); the
  app itself is auth-walled and not agent-indexed.
- Client-side routing means cold loads of `/library` fetch the SPA shell first.
  Mitigated by lazy-loaded pages (`src/router.tsx`) and edge-cached HTML.
- `caches.default` and the R2 binding are unavailable in pure-`vite` dev; the
  Worker dev server (`pnpm dev:worker`) provides them and the SPA dev server
  (`pnpm dev:spa`) proxies `/api` to it.

## Alternatives considered

- **Stay on Next.js + OpenNext:** rejected — operational cost (patch scripts,
  build timeouts, `ignoreBuildErrors`) with no SSR benefit for this app.
- **Astro for the whole app:** Astro is used for the landing overlay only;
  adopting it for the auth-walled SPA would have required rebuilding the React
  component tree as Astro islands.
- **Remix / TanStack Start on Workers:** considered; Hono + Vite kept the
  existing React 19 component tree intact and the dependency surface smaller.
