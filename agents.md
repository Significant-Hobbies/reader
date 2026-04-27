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

## Active context
