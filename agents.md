# agents.md — reader

## Shared Fleet Standard

Also read and follow the shared fleet-level agent standard at `../AGENTS.md`. Treat this repository as owned product code: protect production stability, keep changes scoped, verify work, and record durable follow-up tasks when something remains incomplete or blocked.

## Purpose

Personal research library — capture, read, annotate, and AI-chat with web articles and PDFs, with a companion Chrome MV3 extension.

## Stack

- Framework: Vite + React 19 SPA (single `app.html` entry, client-side routing via `react-router-dom`)
- Backend: Hono Worker (`src/worker.ts`) mounting `/api/*` routes from `src/worker/routes/*.ts`
- Language: TypeScript
- Styling: Tailwind CSS v4 (`@tailwindcss/vite`) + `@tailwindcss/typography`, Radix UI. CSS via Lightning CSS transformer + minifier (see `vite.config.ts`)
- DB: Turso (libSQL) via Drizzle ORM
- Auth: better-auth (Google OAuth, Drizzle adapter on Turso). Server config: `src/lib/auth.ts` (`createAuth`). Browser client: `src/lib/auth-client.ts`. Handler is a Hono route — `api.on(['GET','POST'], '/api/auth/*')` in `src/worker.ts`.
- Storage: Cloudflare R2 (PDFs) via Workers binding `PDFS_BUCKET`
- Testing: Vitest (unit), Playwright (e2e)
- Deploy: Cloudflare Workers — `pnpm deploy` builds the SPA + Astro landing, then `wrangler deploy`. Worker `main = src/worker.ts`; built SPA served via the `ASSETS` binding (`wrangler.toml`).
- Package manager: pnpm workspace

## Repo structure

```
app.html                  # Single SPA HTML entry (Vite input; carries inline shell CSS)
vite.config.ts            # Vite SPA build (React, Tailwind v4, Lightning CSS)
wrangler.toml             # Worker config: main=src/worker.ts, ASSETS + PDFS_BUCKET bindings
src/
  worker.ts               # Hono Worker entry — security headers, /api/* routing, asset serving
  worker/
    routes/               # Hono API route modules mounted under /api/*
      articles.ts         #   /api/articles  — article CRUD
      boards.ts           #   /api/boards
      lists.ts            #   /api/lists
      ai.ts               #   /api/ai       — AI chat/summary via free-ai gateway
      keys.ts             #   /api/keys     — extension API keys (rdr* keys)
      pdf.ts              #   /api/pdfs     — PDF upload/download (R2-backed)
      share.ts            #   /api/share    — public share endpoints
      misc.ts             #   /api/*        — search, tags, data-export, snapshot, proxy, ext chat, session
  pages/                  # Route page components (LibraryPage, ReaderPage, BoardPage, etc.)
  components/
    ReaderView.tsx        # Article reading mode (typography, annotations)
    PDFReaderClient.tsx   # PDF reading via pdfjs-dist / react-pdf
    NotesAIChat.tsx       # AI chat panel for notes
    ArticleSummary.tsx    # AI-generated summary
    board/                # Board components
    reader/               # Reader components
    ui/                   # Shadcn-style primitives
  hooks/                  # Shared React hooks
  lib/
    db/
      schema.ts           # Drizzle schema (articles, boards, lists, plus better-auth tables)
      client.ts           # Turso libSQL client (createDb)
    articles-db.ts        # Article CRUD (Drizzle/Turso)
    boards-db.ts          # Boards CRUD
    lists-db.ts           # Lists CRUD
    auth.ts               # better-auth server config (createAuth — Drizzle adapter, Google OAuth)
    auth-client.ts        # better-auth browser client
    ai-server.ts          # AI provider config (server)
    storage.ts            # Cloudflare R2 helpers (PDFS_BUCKET binding)
    pdf-service.ts        # PDF file validation (size limit)
packages/
  chrome-extension/       # Chrome MV3 extension (separate Vite build) — excluded from root tooling
landing-astro/            # Astro landing page (built into the deploy via cf:build)
plans/
  migrate-off-firebase.md # Historical: Firebase → Turso + better-auth + R2 (DONE)
  archive/                # Archived plans with timestamps
scripts/
  local-ai.mjs            # Local LLM bridge server (runs alongside the Worker + SPA in dev)
  validate-env.mjs        # Env validation for build/runtime/deploy
drizzle.config.ts         # Drizzle config (Turso, schema at src/lib/db/schema.ts)
```

## Key commands

```bash
# Web app
pnpm dev            # Worker (wrangler dev) + Vite SPA + local-ai.mjs, concurrently
pnpm dev:worker     # wrangler dev only (Worker, port 8787)
pnpm dev:spa        # vite only (SPA dev server, port 5173, proxies /api → 8787)
pnpm build          # validate env + vite build → dist/
pnpm cf:build       # build SPA + Astro landing + overlay landing into dist/
pnpm deploy         # validate env + cf:build + wrangler deploy
pnpm test           # vitest run
pnpm test:e2e       # playwright test
pnpm lint           # eslint
pnpm typecheck      # tsc --noEmit (app + worker tsconfigs); `type-check` aliases this
pnpm format         # biome format --write .
pnpm check          # biome check .

# Database (Turso)
pnpm db:push        # drizzle-kit push
pnpm db:studio      # drizzle-kit studio

# Chrome extension (from packages/chrome-extension/) — separate Vite build
pnpm dev            # vite build --watch → dist/
pnpm build          # vite build (production)
pnpm test           # vitest run
```

## Architecture notes

- **App shape**: Vite + React SPA served from a Hono Worker. The browser loads `app.html` (one entry) and routes client-side via `react-router-dom`; `src/worker.ts` handles `/api/*` and serves built assets via the `ASSETS` binding. No SSR, no Next.js.
- **DB + Auth**: Turso (libSQL) via Drizzle. `src/lib/db/schema.ts` defines articles/boards/lists plus better-auth tables (`users`, `baSessions`, `baAccounts`, `baVerifications`). better-auth uses the Drizzle adapter; only Google OAuth is configured. Auth is mounted as a Hono catch-all route (`/api/auth/*`) in `src/worker.ts`.
- **PDF storage**: PDFs live in Cloudflare R2 (binding `PDFS_BUCKET`). Upload/download go through the Hono `/api/pdfs` routes (`src/worker/routes/pdf.ts`) so auth + ownership are enforced server-side. See `src/lib/storage.ts`.
- **Chrome extension**: Manifest V3. Side panel (not popup) for chat UI. Content script uses `@mozilla/readability` for page extraction. Authenticates with `rdr*` API keys via `/api/keys`. Builds independently in `packages/chrome-extension/`; excluded from root Biome/ESLint tooling.
- **PDF support**: `pdfjs-dist` (+ `react-pdf`) for rendering. `src/lib/pdf-service.ts` only validates uploaded PDFs (size limit).
- **Boards**: Kanban view using `@xyflow/react`.
- **AI**: `@ai-sdk/openai-compatible` + Vercel AI SDK, routed through the `AI_BASE_URL` free-ai gateway (`wrangler.toml`) with an `x-gateway-project-id: reader` header. `scripts/local-ai.mjs` bridges a local LLM in dev.
- **React Query**: `@tanstack/react-query` for client data fetching; `ReactQueryHydrate` is a thin `HydrationBoundary` wrapper for seeding the client query cache.
- **pnpm workspace**: root is the Vite SPA + Hono Worker; `packages/chrome-extension` and `landing-astro` are separate workspace builds.
- **Env vars**: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, plus the Cloudflare R2 binding. Validated by `scripts/validate-env.mjs`. No Firebase, no NextAuth.
- Do NOT commit `.env` or auth credentials — verify `.gitignore` before any push.
- Pre-commit hook via Husky: lint-staged runs ESLint (`--fix`) + Biome formatter on staged files.

<!-- FLEET-GUIDANCE:START -->

## Fleet Guidance

### Adding Tasks

- Add durable work items in SaaS Maker Cockpit Tasks when the task affects product behavior, deployment, user feedback, or fleet maintenance.
- Include the project slug, a concise title, acceptance criteria, priority/status, and links to relevant code, issues, traces, or dashboards.
- If task discovery starts locally in an editor or agent session, mirror the durable next step back into SaaS Maker before handoff.

### Using SaaS Maker

- Treat SaaS Maker as the system of record for project metadata, feedback, tasks, analytics, testimonials, changelog, and fleet visibility.
- Prefer API-first workflows through `fnd api`, the SDK, or widgets instead of one-off scripts when interacting with SaaS Maker features.
- Keep this agent file aligned with the project record when operating rules, integrations, or deployment conventions change.

### Free AI First

- Prefer free/local AI paths for routine development and analysis: the `free-ai` gateway, local models, provider free tiers, and cached context.
- Escalate to paid models only when complexity, correctness risk, or missing capability justifies the cost.
- Note any paid-AI use in the task or handoff when it materially affects cost, reproducibility, or future maintenance.

<!-- FLEET-GUIDANCE:END -->

## Active context

<claude-mem-context>
# Memory Context

# [reader] recent context, 2026-05-04 12:34pm GMT+5:30

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (16,724t read) | 577,586t work | 97% savings

### May 3, 2026

734 9:00a 🔵 Reader — HomeClient article cards lack visual distinction for 'link' type
736 9:01a 🟣 Reader — link-type article cards open URL in new tab with distinct visual treatment and context menu
737 " 🔵 Reader — delete confirmation dialog doesn't handle 'link' type, shows "article" for link items
738 " 🔴 Reader — delete confirmation dialog updated to handle 'link' type with correct copy
739 " 🟣 Reader board — AddWebsiteDialog gains PDF upload mode, becomes "Add Source" with 3-way mode selector
740 " 🔵 Reader — AddWebsiteDialog has orphaned &lt;input tag before conditional JSX causing build error
741 9:02a 🔴 Reader — orphaned &lt;input JSX tag in AddWebsiteDialog fixed, onAddReader wired to BoardCanvasClient
742 " 🟣 Reader board — ReaderNode renders PDFViewer for PDF articles instead of ReaderCore
743 " 🔵 Reader — PDF storage uses Cloudflare R2 via PDFS*BUCKET binding, access proxied through /api/pdfs/:id/download
744 " 🟣 Reader — /reader/[id] server route now redirects link-type articles to their URL
745 " 🔵 Reader Chrome extension — popup still branded "Open in Annotator", extension auth uses rdr* API keys
746 9:03a 🟣 Reader Chrome extension popup — "Save to Library" as primary CTA, "Import & Read" as secondary action
748 9:04a 🔵 Reader — pnpm type-check broken: tsconfig.json only includes saas-maker package paths, not project source
749 " ✅ Reader Chrome extension — production build passes with new Save to Library feature (1844 modules, 2.66s)
750 9:05a 🟣 Reader Chrome extension side panel — SaveButton restructured with Save to Library primary + Import &amp; Read secondary
751 " ✅ Reader — full test suite passes (40 tests) and prettier formatting clean after link/PDF/board feature work
752 9:45a 🔵 Fleet monorepo tsconfig architecture — shared @saas-maker/tsconfig package
753 9:46a ✅ reader tsconfig.json — added local overrides for paths, baseUrl, and relaxed strict flag
754 " 🔵 TypeScript 6+ deprecates baseUrl — causes TS5101 error in reader type-check
755 " 🔴 reader tsconfig.json — removed deprecated baseUrl to fix TS5101 error
756 9:47a 🔵 reader type-check reveals TS6133 unused 'request' params in API route handlers
757 " 🔵 reader API route handlers — GET and DELETE methods declare unused 'request' param pattern
758 9:49a 🔵 @saas-maker/tsconfig include paths resolve relative to package dir — TS18003 across 6+ Fleet projects
760 9:50a 🔵 CodeVetter root tsconfig fails — @saas-maker/tsconfig not installed, node.json extends wrong for React apps
761 " ✅ reader — final diff before commit: tsconfig fix + \_request renames + broader feature changes staged
762 9:55a 🔵 SAAS Maker feedback API rejects type "task" — HTTP 400 Invalid type
763 " ✅ Fleet tsconfig fix — maintenance task filed in SAAS Maker feedback as bug ID 07a0216b
768 10:05a 🔵 Chrome reading list empty across all profiles — extension data unavailable
769 " 🔵 reader project data layer architecture — lists-db.ts and articles-db.ts
770 10:07a 🔵 Chrome Profile 2 reading list — complete URL inventory from LevelDB
771 10:08a 🔵 Reader app searchArticles — in-memory full-text search, not FTS5
772 " 🔵 Reader app schema.ts — full articles + boards table definitions
773 " 🔵 gaurigupta19.github.io Chrome reading list URLs — all 404
774 10:09a 🔵 Reader project uses dotenvx, not plain dotenv
775 10:11a 🔵 Reader production Turso DB — single user confirmed via live query
776 " 🔵 Chrome reading list — additional article titles resolved from LevelDB
777 " 🔵 Reader app — complete articles-db and lists-db public API surface
778 " 🔵 Chrome reading list URLs — live reachability confirmed for 8 articles
779 10:12a 🔵 Chrome reading list — complete live URL inventory: 14 of 15 articles reachable
780 " 🟣 Chrome reading list bulk-imported into reader app production DB
781 10:13a 🔵 Chrome Reading List import verified — all 28 articles confirmed as type:link in Turso
782 10:14a 🔵 Chrome open tabs session — local-ai GitHub repo and additional articles discovered
783 10:15a 🔵 Chrome open tabs — extended article inventory for potential reader import
786 10:18a ⚖️ Reader app — pivot from import tool to future reading queue
787 11:44a 🔵 Reader app data layer — article creation + list management API surface mapped
788 11:45a 🔵 Reader app Turso DB — local tsx script access pattern requires dotenv pre-load
789 " 🔵 Reader app — all 28 Chrome reading list articles confirmed in DB with correct list assignment
790 11:49a 🔵 Chrome open tabs extracted via osascript — 29 URLs enumerated for potential reader app import
791 11:53a 🟣 29 Chrome open tabs bulk-closed via osascript after enumeration
792 " 🔵 Reader app "Chrome Open Tabs" list has 2 stale URL mismatches — trailing slash differences

Access 578k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>
