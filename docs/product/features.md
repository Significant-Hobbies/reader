# Feature Inventory (shipped)

Current feature surface. Source of truth for "what does the app do today";
update when behaviour changes. For the API route map, see
[architecture/data-flow.md](../architecture/data-flow.md).

## Reading & capture

- **Article capture from URL** via `@mozilla/readability` + `linkedom` running
  server-side in the `/api/snapshot` flow. HTML is sanitised before storage and
  re-sanitised on read for defence-in-depth.
- **PDF upload, view, annotate, text extraction.** PDFs are stored in
  Cloudflare R2 (`PDFS_BUCKET`); downloads are proxied through
  `/api/pdfs/:id/download` so auth + ownership are enforced server-side. PDF
  MIME is validated by magic bytes (`%PDF-`); 10 MB per-file limit
  (`src/lib/pdf-service.ts`). PDFs use a `blob://<storageKey>` sentinel as the
  article `url` to avoid colliding with the user-URL uniqueness index.
- **Link-type articles.** `/reader/:id` redirects link-type articles to their
  canonical URL; cards in the library open the URL in a new tab with a distinct
  visual treatment and context menu.
- **Rich annotations** with optional DOM anchoring; selection actions
  (mouse-up or selection + right-click) expose `Add note` and `Ask AI`.
- **Reading-time estimates** auto-calculated; customisable reader (theme
  light/dark/sepia, font sans/serif/mono, text size).

## RSS / Atom inbox (`/rss`)

- OPML import that recursively reads outlines with `xmlUrl`, deduplicates per
  user, and reports imported/existing/rejected counts.
- Direct feed add/remove with SSRF-validated HTTP(S) URLs.
- Manual refresh with bounded concurrency (4 feeds at a time, 15 s timeout per
  feed), per-feed success/error reporting, `ETag` / `Last-Modified` support,
  and a response-size + entry cap. One bad feed does not abort the others.
- Unread/read inbox state; opening an entry marks it read and opens the
  canonical URL in a new tab.
- Save an entry to the library exactly once (idempotent); creates an article
  record when content is available, otherwise a link-type article.
- See [architecture/decisions/0008-rss-inbox.md](../architecture/decisions/0008-rss-inbox.md)
  and the repository's [GitHub Issues](https://github.com/Significant-Hobbies/reader/issues)
  for current operational follow-up.

## Organisation & search

- **Tags** with colour badges, autocomplete, and filtering.
- **Lists** (grouping) and **Boards** (Kanban-style view via `@xyflow/react`).
  Boards and lists have shareable share-link endpoints.
- **Full-text search** across article content, notes, and AI chat history
  (Cmd/Ctrl+K). Search is in-memory `LIKE`-style today, not FTS5 — see
  [knowledge/learnings.md](../knowledge/learnings.md) for the trade-off.
- **Reading progress** tracking (`in_progress` / `completed` status).
- **Session review** per article (`POST /api/articles/:id/session-review`).

## AI features

- **Per-article AI chat** with persistent markdown history.
- **Auto-summaries** (short/medium/long) and **key points** extraction (3–5
  bullets) via `POST /api/ai/summarize`.
- **BYOK providers** (OpenAI/Anthropic/Gemini) + free-ai gateway + local AI
  mode. BYOK keys are sent per-request from the browser and never persisted
  server-side. See [architecture/decisions/0005-ai-gateway-byok.md](../architecture/decisions/0005-ai-gateway-byok.md).
- **Model listing** via `POST /api/ai/models` (proxies `/models` on the
  configured endpoint).

## Memory capture

- `/memory` page with persisted, authenticated captures (`memories` D1
  table, `/api/memories` CRUD + `/api/memories/search`).
- `POST /api/browser-memory/import` for browser-memory imports.
- Global SearchBar routes memory hits to `/memory`.

## Chrome extension (MV3)

- Side panel (persistent chat surface) + popup (ephemeral one-click capture).
- Content script runs `@mozilla/readability` in the page context on demand.
- Chrome Reading List sync (URLs, titles, read state).
- Authenticates with `rdr_*` API keys via `/api/keys` (hashed at rest).
- See [architecture/decisions/0006-mv3-side-panel.md](../architecture/decisions/0006-mv3-side-panel.md)
  and `packages/chrome-extension/README.md`.

## Security & audit fixes (carried forward from the Firebase era)

- Auth on snapshot routes; SSRF validation (`src/lib/url-validation.ts`) and
  redirect-safe fetch (`src/lib/safe-fetch.ts`) on all server-side URL fetches.
- PDFs accessed only through authenticated, ownership-checked proxy routes
  (no public R2 URLs).
- HTML sanitised at ingestion and re-sanitised on read.
- Security headers applied in `src/worker.ts` (`X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS).
- Residual / deferred items: no explicit CORS config (acceptable same-origin),
  no rate limiting on AI/snapshot/proxy (deferred pending evidence). See
  [archive/security-audit-2026-03-29.md](../archive/security-audit-2026-03-29.md).
