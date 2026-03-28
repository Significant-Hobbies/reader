# Web Annotator

Personal research library for capturing, reading, annotating, and organizing web content with AI assistance.

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS 4 + `@tailwindcss/typography`, Radix UI primitives, `lucide-react` icons
- **Database**: Firebase (Firestore) -- articles in `annotations` collection (legacy name), plus `projects`, `lists`, `boards`
- **Auth**: Firebase Auth with Google Sign-In, server-side session cookies (`__session`, 14-day expiry), verified via `firebase-admin`
- **AI**: Vercel AI SDK (`ai` + `@ai-sdk/*`) for streaming chat/summarization. Supports Gateway (default, no key needed), OpenAI, Anthropic, Google (BYOK), and local CLI bridge
- **PDF**: `react-pdf`, `pdfjs-dist`, `pdf-parse`
- **Canvas/Board**: `@xyflow/react` for node-based research boards
- **State**: React Query (`@tanstack/react-query`) with server-side prefetching
- **Content Processing**: `@mozilla/readability` + `linkedom` for article extraction, `sanitize-html` for XSS prevention
- **SaaS Maker**: feedback, testimonials, changelog, analytics
- **Dev Tooling**: ESLint 9 + Prettier + Husky + lint-staged
- **Runtime**: Node.js 24.x, deployed on Vercel

## Architecture

```
src/
  app/
    layout.tsx              # Root layout: AuthProvider > QueryProvider > children + SaaSMaker widgets
    page.tsx                # Home -- SSR with prefetched articles, redirects to /login if unauthenticated
    login/page.tsx          # Google Sign-In page
    reader/[id]/page.tsx    # Article/PDF reader view
    board/                  # Research boards (list + canvas views)
      page.tsx              # Board list
      [id]/page.tsx         # Board canvas
    share/                  # Public shared views (articles + boards)
    api/
      auth/session/         # POST: create session cookie, DELETE: clear it
      articles/             # CRUD for articles
      articles/[id]/        # GET/PATCH/DELETE single article
      articles/[id]/lists/  # PUT/DELETE to add/remove article from lists
      boards/               # CRUD for boards
      lists/                # CRUD for lists (Favourites, Read Later, custom)
      ai/chat/              # POST: streaming AI chat (multi-provider)
      ai/summarize/         # POST: generate article summary/key points
      ai/models/            # GET: list available models
      search/               # GET: full-text search
      snapshot/             # POST: capture article from URL via Readability
  components/
    HomeClient.tsx          # Main dashboard: article list, list sidebar, tag filtering
    reader/ReaderCore.tsx   # Core reader with notes, AI chat, summary panels
    NotesAIChat.tsx         # AI chat panel (multi-provider, streaming)
    board/
      BoardCanvasClient.tsx # XYFlow canvas with drag-and-drop nodes
      nodes/                # Node types: Website, Note, AIChat, Iframe, Reader
    ui/                     # Radix-based primitives
  lib/
    firebase.ts             # Client-side Firebase init
    firebase-admin.ts       # Server-side Firebase Admin SDK
    auth-server.ts          # Session cookie management
    articles-service.ts     # Article CRUD, sanitization, search
    boards-service.ts       # Board CRUD, node/edge sanitization
    lists-service.ts        # Lists CRUD (Favourites, Read Later, custom)
    ai-config.ts            # AI provider types, model lists
    ai-server.ts            # AI SDK wrappers, local CLI bridge stream
  types.ts                  # All shared TypeScript interfaces
```

## Key Conventions

- **Path aliases**: `@/*` maps to `src/*`
- **Auth pattern**: Every API route calls `getAuthenticatedUserId()` first
- **Sanitization**: All user input sanitized via `sanitize-html` before storage
- **Ownership**: Every query filters by `userId`
- **Article collection name**: Collection is `annotations` (historical), via `ARTICLES_COLLECTION` constant
- **Lists > Projects**: `projectId` deprecated. Use `listIds[]` (array-contains queries)
- **AI keys**: BYOK stored in browser only (`localStorage`), sent per-request
- **Streaming**: AI responses use plain text streams (not SSE)
- **Commit style**: Conventional Commits (`feat(scope): message`)

## Commands

```bash
npm run dev          # Start Next.js + cli-bridge via concurrently
npm run dev:app      # Start only Next.js
npm run build        # Production build
npm run lint         # ESLint
npm run format       # Prettier --write
npm run type-check   # tsc --noEmit
```

## Environment Variables

```bash
# Required -- Firebase
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_SERVICE_ACCOUNT_KEY=          # base64-encoded service account JSON

# Optional
AI_GATEWAY_API_KEY=                    # Server-side fallback for Vercel AI Gateway
CLI_BRIDGE_URL=http://127.0.0.1:3456  # Local CLI bridge endpoint
NEXT_PUBLIC_SAASMAKER_API_KEY=         # SaaS Maker integration
```

## Current State

**Done:**

- Full article capture (URL via Readability + PDF upload)
- Reader view with themes (light/dark/sepia), fonts, font sizes
- Notes with optional DOM anchoring, text selection actions
- AI chat per article (multi-provider streaming)
- AI summaries + key points extraction
- Lists system (Favourites, Read Later, custom) replacing legacy projects
- Tags with color-coded badges, autocomplete, filtering
- Full-text search (Cmd+K)
- Research boards (XYFlow canvas) with 5 node types
- Public sharing for articles and boards
- Google Sign-In auth with session cookies
- Pre-commit hooks (lint + format)

**Migration in progress:**

- `projectId` deprecated in favor of `listIds[]` -- migration script exists

**Not done:**

- No tests
- Search is client-side (loads all docs, filters in memory)
- No offline support or PWA
- No export functionality
