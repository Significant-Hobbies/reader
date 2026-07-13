# reader — PROJECT STATUS

Last updated: 2026-07-13

## Why / What

Reader is a personal reading and annotation app for capturing articles and PDFs, organizing them with tags and projects, tracking progress, and running AI-assisted summaries, key points, and chat over saved material.

**Users:** Individual readers saving articles/PDFs; signed-in users via Google OAuth; operators running Turso migrations and Cloudflare deploys.

**Constraints:** Same-origin Worker + SPA pattern; rate limits deferred until endpoint-specific evidence. Memory capture is persisted and authenticated (Turso `memories` table, `/api/memories` routes, `/memory` UI page).

**IN scope:** Article/PDF capture, annotations, tags/projects, full-text search, AI chat/summaries, boards/lists, Turso persistence, R2 PDF storage, free-ai gateway + BYOK + local-ai dev bridge.

**OUT of scope:** Browser-extension distribution, full personal knowledge-base automation, paid team/library workflows, separate `landing-astro` deployable product.

Ships as a Vite + React 19 SPA with a Hono Worker backend on Cloudflare Workers.

## Dependencies

### External

- **Turso (libSQL):** Primary persistence for articles, tags, projects, progress, chat, auth sessions.
- **Cloudflare R2:** `reader-pdfs` (`PDFS_BUCKET`) — PDF binary storage; signed URL access.
- **PostHog:** Product analytics via `posthog-js`.
- **Mozilla Readability + linkedom:** Article extraction.
- **pdfjs / react-pdf:** In-browser PDF viewing.
- **Env files:** See `.env.example` / deploy validation — Turso, auth, AI gateway, R2 bindings in `wrangler` config.

### Internal (fleet)

| Service                        | Role                                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| **free-ai**                    | Default AI chokepoint via `AI_BASE_URL` (`https://ai-gateway.sassmaker.com/v1`) |
| **local-ai**                   | Dev bridge for authenticated local CLI models (`pnpm local-ai`)                                      |
| **SaaS Maker feedback widget** | In-app feedback capture via `@saas-maker/feedback`                                                   |

### Stack & commands

**Stack:** Vite 8 · React 19 · React Router 7 · Tailwind v4 · TanStack Query · Hono Worker `src/worker.ts` · Turso · Drizzle ORM · better-auth Google OAuth · R2 `reader-pdfs` · free-ai-gateway · PostHog · `@saas-maker/feedback` · Mozilla Readability + linkedom · pdfjs/react-pdf.

| Command                                          | Purpose                                   |
| ------------------------------------------------ | ----------------------------------------- |
| `pnpm install`                                   | Install deps                              |
| `pnpm dev`                                       | worker + SPA + local-ai (concurrently)    |
| `pnpm dev:spa`                                   | vite only                                 |
| `pnpm dev:worker`                                | wrangler dev only                         |
| `pnpm local-ai`                                  | local AI bridge                           |
| `pnpm build`                                     | vite build (validate env)                 |
| `pnpm cf:build`                                  | build + landing-astro + overlay           |
| `pnpm deploy`                                    | validate env + cf:build + wrangler deploy |
| `pnpm typecheck` / `pnpm test` / `pnpm test:e2e` | TS + vitest + playwright                  |
| `pnpm check`                                     | biome check                               |
| `pnpm db:push` / `pnpm db:studio`                | Drizzle push / studio                     |
| `pnpm migrate:firestore`                         | legacy Firestore → Turso migration        |
| `pnpm memory:demo`                               | memory capture prototype demo             |

CI: GitHub Actions auto-deploy to Cloudflare on push to `main`.

**Entrypoints:** `src/worker.ts` · route modules under `src/worker/routes/` · optional `landing-astro/` overlay merged into `dist/` during `cf:build`.

## Timeline

- **2026-07-13** — Added an authenticated RSS/Atom reader with OPML import, direct add/remove feed management, bounded manual refresh, unread/read inbox state, and save-to-library actions. The additive `0002_first_green_goblin.sql` migration must be applied before deployment.
- **2026-07-03** — Memory capture promoted from prototype to persisted, authenticated flow. `memories` Turso table + `/api/memories` CRUD/search routes + `/memory` UI page + browser-memory import all wired. Global SearchBar routes memory hits to `/memory`. Read-and-remember instead of read-and-forget.
- **2026-07-02** — Added `api.onError()` global error handler + outer try/catch in worker fetch handler; added React `<ErrorBoundary>` wrapping `RouterProvider` in `bootstrap.tsx`.
- **Wave 2 migration** — De-OpenNext migration to Vite + React 19 SPA + Hono worker; Worker name `reader` preserved. Turso/Drizzle persistence; better-auth Google; R2 PDF storage.
- **Security audit pass** — Auth on snapshot routes; SSRF validation; signed PDF URLs. Firestore rules addressed during migration; render-time sanitization. Dead middleware removed; critical/high audit findings closed.

## Products

| Surface                 | URL                                                        |
| ----------------------- | ---------------------------------------------------------- |
| Production app          | `https://read.significanthobbies.com`             |
| AI gateway (Worker var) | `https://ai-gateway.sassmaker.com/v1` |
| Canonical / OG          | Set in `landing-astro/astro.config.mjs` and built `dist/`  |

Production uses the `read.significanthobbies.com` custom domain on the canonical Cloudflare Worker; Pages remains reverted.

## Features (shipped)

### Architecture

- Browser (React 19 SPA, TanStack Query, React Router) calls same-origin `/api/*` + static `dist` via ASSETS binding.
- Cloudflare Worker `reader` (Hono) routes: articles, boards, lists, pdf, ai, share, keys, misc (snapshot, proxy, browser-memory import).
- Turso (libSQL) + Drizzle ORM for persistence; better-auth Google OAuth for sessions.
- R2 `reader-pdfs` (`PDFS_BUCKET`) stores PDF binaries with signed URL access.
- AI flows through `AI_BASE_URL` → free-ai-gateway, with BYOK (OpenAI/Anthropic/Gemini) and `scripts/local-ai.mjs` dev bridge.
- Landing: optional `landing-astro/` overlay merged into `dist/` during `cf:build`; SPA fallback via `not_found_handling = single-page-application` pattern.
- PostHog analytics via `posthog-js`; SaaS Maker feedback widget embedded in app shell.

### Reading & capture

- Article capture from URL via Mozilla Readability; PDF upload, view, annotate, text extraction.
- Rich annotations with optional DOM anchoring; selection actions (Add note / Ask AI).
- Reading time estimates; customizable reader (theme, font, size).
- RSS/Atom inbox at `/rss`: OPML import, direct feed add/remove, manual refresh with partial-failure reporting, unread/read filtering, and save-to-library.

### Organization & search

- Tags with color badges, autocomplete, filtering.
- Full-text search across content, notes, AI chat (Cmd/Ctrl+K).
- Projects grouping; reading progress tracking.
- Boards/lists routes (`/board`, `/board/:id`, share links).

### AI features

- Per-article AI chat with persistent markdown history.
- Auto-summaries (short/medium/long); key points extraction (3–5 bullets).
- BYOK providers + gateway + local AI mode.

### Memory capture (prototype)

- `/memory` route with fixture-backed examples.
- `POST /api/browser-memory/import` import endpoint.
- Not yet authenticated or persisted as full product flow.

### Security & audit fixes

- Auth on snapshot routes; SSRF validation; signed PDF URLs.
- Firestore rules addressed during migration; render-time sanitization.
- Dead middleware removed; critical/high audit findings closed.

## Todo / Planned / Deferred / Blocked

### Planned

1. ~~Turn memory capture prototype into authenticated, persisted product flow.~~ **Done** — `memories` table, `/api/memories` routes, `/memory` UI page, browser-memory import.
2. ~~Move prototype search from in-memory behavior to Turso-backed search where it matters.~~ **Done** — `/api/memories/search` is Turso-backed; global SearchBar routes memory hits to `/memory`.
3. ~~Clarify PDF storage behavior.~~ **Paused** at the current documented representation; reopen for a concrete storage defect.
4. ~~Add abuse and rate-limit handling.~~ **Paused** until endpoint-specific evidence exists.

### Closure

- **Personal-use support (2026-07-10):** Keep Reader available for direct use. No roadmap expansion; accept only maintenance, reliability, or personally requested workflow fixes. The preexisting generated `dist/` worktree drift is not part of this decision.

### Deferred

- RSS background refresh/scheduled triggers, notifications, OPML folder preservation, and feed discovery. Current RSS refresh is manual. `drizzle/0002_first_green_goblin.sql` is the canonical migration and is applied to production.
- Browser-extension distribution until web import and capture flow are reliable.
- Full personal knowledge-base automation behind strong capture, retrieval, and trust primitives.
- Paid team/library workflows.
- `landing-astro` is optional overlay only — not a separate deployable product surface.
- Memory capture is persisted and authenticated: `memories` Turso table, `/api/memories` CRUD + search routes, `/memory` UI page, browser-memory import. Global SearchBar routes memory hits to `/memory`.
- Residual audit: no explicit CORS config (acceptable for same-origin today); no rate limiting on AI/snapshot/proxy endpoints (deferred pending evidence).
- README still describes pre-migration Next.js layout in places; canonical runtime is Vite SPA + Hono worker.

### Blocked

- (none)
