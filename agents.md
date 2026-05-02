# agents.md — reader

## Purpose

Personal research library — capture, read, annotate, and AI-chat with web articles and PDFs, with a companion Chrome MV3 extension.

## Stack

- Framework: Next.js 16 (App Router), React 19
- Language: TypeScript
- Styling: Tailwind CSS v4 + `@tailwindcss/typography`, Radix UI
- DB: Turso (libSQL) via Drizzle ORM
- Auth: better-auth (Google OAuth, Drizzle adapter on Turso). Server: `src/lib/auth.ts`. Client: `src/lib/auth-client.ts`. Dynamic handler at `src/app/api/auth/[...all]/route.ts`.
- Storage: Cloudflare R2 (PDFs) via Workers binding `PDFS_BUCKET`
- Testing: Vitest (unit), Playwright (e2e)
- Deploy: Cloudflare Workers (OpenNext for Next.js) — `pnpm deploy`
- Package manager: pnpm workspace

## Repo structure

```
src/
  app/
    page.tsx             # Home (article library)
    login/               # Login page
    reader/              # Article reader view
    board/               # Kanban board view
    share/               # Public share page
    api/                 # REST API routes
  components/
    ReaderView.tsx        # Article reading mode (typography, annotations)
    PDFReaderClient.tsx   # PDF reading via pdfjs-dist / react-pdf
    NotesAIChat.tsx       # AI chat panel for notes
    ArticleSummary.tsx    # AI-generated summary
    board/               # Board components
    reader/              # Reader components
    ui/                  # Shadcn-style primitives
  lib/
    db/
      schema.ts          # Drizzle schema (articles, boards, lists, plus better-auth tables)
      client.ts          # Turso libSQL client
    articles-db.ts       # Article CRUD (Drizzle/Turso)
    articles-service.ts  # Business logic layer
    boards-db.ts         # Boards CRUD
    auth.ts              # better-auth server config (Drizzle adapter, Google OAuth)
    auth-client.ts       # better-auth browser client
    auth-server.ts       # Server-side session helpers
    ai-server.ts         # AI provider config (server)
    storage.ts           # Cloudflare R2 helpers (PDFS_BUCKET binding)
    pdf-service.ts       # PDF text extraction
packages/
  chrome-extension/      # Chrome MV3 extension (separate Vite build)
    manifest.json        # MV3 manifest — side panel, content script, service worker
    src/                 # Extension source (background, content script)
    side-panel/          # Side panel HTML entry
    vite.config.ts       # Extension Vite config (builds independently)
plans/
  migrate-off-firebase.md  # Historical: Firebase → Turso + better-auth + R2 (DONE)
  archive/                 # Archived plans with timestamps
scripts/
  local-ai.mjs            # Local LLM bridge server (runs alongside Next.js in dev)
drizzle.config.ts         # Drizzle config (Turso, schema at src/lib/db/schema.ts)
```

## Key commands

```bash
# Web app
pnpm dev            # Next.js + local-ai.mjs concurrently
pnpm dev:app        # Next.js only (port 3000)
pnpm build          # next build
pnpm test           # vitest run
pnpm test:e2e       # playwright test
pnpm lint           # eslint
pnpm type-check     # tsc --noEmit

# Database (Turso — migration target)
pnpm db:push        # drizzle-kit push
pnpm db:studio      # drizzle-kit studio

# Chrome extension (from packages/chrome-extension/)
pnpm dev            # vite build --watch → dist/
pnpm build          # vite build (production)
pnpm test           # vitest run
```

## Architecture notes

- **DB + Auth**: Turso (libSQL) via Drizzle. `src/lib/db/schema.ts` defines articles/boards/lists plus better-auth tables (`users`, `baSessions`, `baAccounts`, `baVerifications`). better-auth uses the Drizzle adapter; only Google OAuth is configured.
- **PDF storage**: PDFs live in Cloudflare R2 (binding `PDFS_BUCKET`). Downloads always proxy through `/api/pdfs/[id]/download` so auth + ownership are enforced server-side. See `src/lib/storage.ts`.
- **Chrome extension**: Manifest V3. Side panel (not popup) for chat UI. Content script uses `@mozilla/readability` for page extraction. Communicates with the web app. Builds independently in `packages/chrome-extension/`.
- **PDF support**: `pdfjs-dist` for rendering, `pdf-parse` for text extraction.
- **Boards**: Kanban view at `/board` using `@xyflow/react`.
- **AI**: `@ai-sdk/openai-compatible` + Vercel AI SDK. `scripts/local-ai.mjs` bridges a local LLM in dev.
- **React Query**: `@tanstack/react-query` for client data fetching; `ReactQueryHydrate` for SSR hydration.
- **pnpm monorepo**: root is the Next.js web app; `packages/chrome-extension` is a separate workspace package.
- **Env vars**: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, plus the Cloudflare R2 bindings. No Firebase, no NextAuth.
- Do NOT commit `.env` or auth credentials — verify `.gitignore` before any push.
- Pre-commit and pre-push hooks via Husky: lint-staged runs ESLint + Prettier.

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

# [reader] recent context, 2026-05-02 4:19pm GMT+5:30

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 38 obs (11,917t read) | 433,317t work | 97% savings

### May 2, 2026
598 2:37p 🔵 Reader project — chrome extension package structure confirmed
599 " 🔵 Reader chrome extension — full architecture and API integration documented
600 " 🔵 Reader chrome extension — NOT registered in pnpm workspace, build/test commands silently skip it
601 " 🔵 Reader API key auth — rdr_ prefix, SHA-256 hashed, bearer token bypasses session cookie
602 2:38p 🔵 Reader chrome extension — build, type-check, and tests all pass; dist/ ready to load
603 " 🔵 Reader extension — hardcoded domain mismatch: web-annotator.vercel.app vs actual prod reader-4nu.pages.dev
604 " 🔵 Reader extension — no in-app UI for API key issuance; users must manually POST to /api/keys
605 2:39p 🔴 Reader chrome extension — hardcoded domain fixed from web-annotator.vercel.app to reader-4nu.pages.dev
606 2:40p 🔵 Reader chrome extension — tests pass (15/15), build and type-check confirmed runnable
607 " ✅ Reader chrome extension — domain fix verified, build clean, ready to commit
608 " 🔵 Reader HomeClient — article delete uses confirmation modal + optimistic mutation pattern
609 2:41p 🔴 Reader HomeClient — article card click propagation fixed, delete modal no longer closes on inner click
610 " 🔵 Reader root type-check broken — tsconfig include paths resolve into saas-maker node_modules, finds zero inputs
611 " 🔵 Reader ESLint enforces simple-import-sort — HomeClient.tsx import order violation after MouseEvent addition
635 2:56p 🔵 Reader Chrome Extension — full feature inventory
636 " 🔵 Reader — API key management endpoint architecture
637 " 🔵 Reader — infra stack: Cloudflare Workers + Pages, Turso DB, R2, free-ai-gateway
638 " 🔵 Reader — auth: better-auth with Google OAuth only, no Firebase/NextAuth
641 2:57p 🔵 Reader — production confirmed live at reader-4nu.pages.dev, deployed as Cloudflare Worker
642 " 🔵 Reader — app routes: /board route exists, SaaSMaker integrated in root layout
643 " 🔵 Reader — API key revocation uses soft-delete; 404 masks already-revoked vs not-found
644 " ✅ Reader — production domain migrated from reader-4nu.pages.dev to reader.sarthakagrawal927.workers.dev
645 2:58p 🟣 Reader — /extension page added for Chrome extension API key onboarding
652 3:00p ✅ Reader — extension auth UX improved: PageHeader links to /extension, Navbar adds Chrome extension entry
653 " ✅ Reader deploy workflow migrated from Cloudflare Pages to Workers deploy command
654 " 🔵 Reader — complete route map from production build
669 3:08p 🔵 Reader — /extension route returns 404 in production; changes not yet deployed
673 3:11p ⚖️ Deploy-now, polish-later decision made for in-progress feature
674 " 🟣 Reader — extension onboarding page deployed to production
675 3:12p 🔵 Reader deploy command — pnpm deploy vs pnpm run deploy
676 " 🔵 Reader — full route inventory at deploy time (May 2, 2026)
677 " 🔵 Reader build applies WeakRef/FinalizationRegistry polyfill to worker.js
678 " ✅ Reader — 7 new static assets uploaded to Cloudflare on deploy
679 3:13p 🟣 Reader — /extension onboarding page successfully deployed to Cloudflare Workers
680 " 🔵 Reader — /extension page confirmed HTTP 200 in production
681 " 🔵 Reader project linked to Foundry/SASS Maker CLI (fnd) at api.sassmaker.com
683 3:14p 🔵 SASS Maker fnd CLI — tasks endpoint absent, /v1/feedback used instead
684 " 🟣 Reader — cleanup task created in SASS Maker for smooth extension auth flow

Access 433k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>