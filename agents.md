# agents.md — reader

## Purpose
Personal research library — capture, read, annotate, and AI-chat with web articles and PDFs, with a companion Chrome MV3 extension.

## Stack
- Framework: Next.js 16 (App Router), React 19
- Language: TypeScript
- Styling: Tailwind CSS v4 + `@tailwindcss/typography`, Radix UI
- DB: Firebase Firestore (current/active) + Turso/libSQL via Drizzle (migration in progress — schema exists, not yet primary)
- Auth: Firebase Auth (Google, current) + `firebase-admin` session cookies; target: NextAuth v5
- Testing: Vitest (unit), Playwright (e2e)
- Deploy: Vercel
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
      schema.ts          # Drizzle schema (Turso target — migration in progress)
      client.ts          # Turso libSQL client
    articles-db.ts       # Firestore article CRUD (current active path)
    articles-service.ts  # Business logic layer
    boards-db.ts         # Firestore boards CRUD
    auth.ts              # Auth helpers (browser)
    auth-server.ts       # Firebase Admin session auth
    ai-server.ts         # AI provider config (server)
    storage.ts           # Vercel Blob helpers
    pdf-service.ts       # PDF text extraction
packages/
  chrome-extension/      # Chrome MV3 extension (separate Vite build)
    manifest.json        # MV3 manifest — side panel, content script, service worker
    src/                 # Extension source (background, content script)
    side-panel/          # Side panel HTML entry
    vite.config.ts       # Extension Vite config (builds independently)
plans/
  migrate-off-firebase.md  # ACTIVE migration plan: Firebase → Turso + NextAuth v5 + Vercel Blob
  archive/                 # Archived plans with timestamps
scripts/
  local-ai.mjs            # Local LLM bridge server (runs alongside Next.js in dev)
  migrate-firestore-to-turso.ts  # One-time migration script
drizzle.config.ts         # Drizzle config (Turso, schema at src/lib/db/schema.ts)
firestore.rules           # Firestore security rules
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
- **ACTIVE MIGRATION**: Firebase Firestore → Turso + NextAuth v5 + Vercel Blob. Both paths live simultaneously. `articles-db.ts` (Firestore) is the current active path. `src/lib/db/schema.ts` (Drizzle/Turso) is the migration target. See `plans/migrate-off-firebase.md`.
- **Chrome extension**: Manifest V3. Side panel (not popup) for chat UI. Content script uses `@mozilla/readability` for page extraction. Communicates with web app at `https://web-annotator.vercel.app`. Builds independently in `packages/chrome-extension/`.
- **PDF support**: `pdfjs-dist` for rendering, `pdf-parse` for text extraction.
- **Boards**: Kanban view at `/board` using `@xyflow/react`.
- **AI**: `@ai-sdk/openai-compatible` + Vercel AI SDK. `scripts/local-ai.mjs` bridges a local LLM in dev.
- **React Query**: `@tanstack/react-query` for client data fetching; `ReactQueryHydrate` for SSR hydration.
- **pnpm monorepo**: root is the Next.js web app; `packages/chrome-extension` is a separate workspace package.
- Do NOT commit `.env` or Firebase credentials — verify `.gitignore` before first commit.
- Pre-commit and pre-push hooks via Husky: lint-staged runs ESLint + Prettier.

## Active context
