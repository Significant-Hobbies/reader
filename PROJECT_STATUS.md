# PROJECT_STATUS — Reader

This is Reader's durable current and shipped product truth. For the full
product, feature, and architecture record, see [`docs/`](docs/index.md).

## Why / What

Reader is a personal research library for capturing, reading, annotating, and
AI-assisted work over saved articles and PDFs. It remains in personal-use,
maintenance-first support.

## Dependencies

- Vite + React 19 SPA, Hono Worker, Cloudflare D1 + Drizzle, Cloudflare R2,
  better-auth Google OAuth, and optional AI providers. D1 is authoritative;
  the retired Turso database was deleted on 2026-08-02.
- Ultracite 7.10.2 is an exact development-only Biome preset dependency. Local
  exceptions preserve Reader's established SPA, Worker, Astro, and document
  processing style without affecting runtime behavior.

## Timeline

- **2026-09-07:** Fixed a reproduced local IndexedDB lost-update bug: concurrent
  title and note edits now merge within one readwrite transaction. Isolated
  Chromium proves article content/notes/count and synthetic PDF bytes survive
  reload; route fixtures verify guest rejection and account-scoped access calls.
  [Evidence and limits](docs/development/testing.md#local-library-persistence).
  Live journey qualification remains [#55](https://github.com/Significant-Hobbies/reader/issues/55);
  guest PDF page notes are now implemented in [#56](https://github.com/Significant-Hobbies/reader/issues/56).
  No deployment or live upload was performed.
- **2026-08-12:** Adopted the Fleet code-health contract across the app,
  Worker, landing, and Chrome extension with truthful whole-library coverage,
  unused-code, cycle, complexity, duplication, dependency, suppression, build,
  docs, and repository-hygiene ratchets in CI. Removed the retired Firebase
  migration and unused extension/UI surfaces; remaining debt is in GitHub.
- **2026-08-09:** Adopted the verified Ultracite-backed Biome baseline through
  the existing non-writing check, with explicit compatibility exceptions and
  no source rewrite, production dependency, storage/auth/AI, migration, or
  deployment change.
- **2026-07-31:** Kept the public sitemap limited to the four canonical HTML
  pages while retaining six machine resources through robots, llms, and the
  agent catalog. Explicit tests now enforce sitemap, catalog, and Markdown
  parity; production deployment remains separate.
- **2026-07-31:** Added locally verified Open Graph/Twitter image metadata and
  SoftwareApplication structured data to the public landing layout; production
  deployment remains separate.
- **2026-07-29:** Added an owned `/changelog` with verified release outcomes and
  direct GitHub Roadmap and Source links.
- **2026-07-13:** Shipped authenticated RSS/Atom reading and OPML import.

## Products

- Public research library at `https://read.significanthobbies.com`.
- Chrome MV3 capture extension.

## Features (shipped)

- Guest PDF page notes: local import/render/navigation, note create/edit/delete,
  saved page anchors and reload. Existing PDF.js API/worker versions are aligned
  to 5.4.624 after a built-browser test exposed a version mismatch.
  Notes stay browser-local; they are not text highlights or embedded PDF edits.
  Account PDFs now use the same page-note editor with account persistence,
  retained page anchors, failed-save draft retention and account-scoped cache/drafts.
  A built-browser journey uses real Hono/Drizzle handlers and isolated SQLite to
  prove create/edit/delete/reload, a failed save and retry, and Alice/Bob isolation.
  Hosted Google/D1/R2 qualification remains #55. Existing background/zoom/page
  controls remain supported; mobile panels stack to keep the PDF visible.

- Account article annotations: cached reopen refreshes clean notes before editing,
  autosave runs only for dirty notes and serializes in-flight changes, including
  marker reanchoring. Failed writes require retry or a new edit. Account/article
  cache keys and reader mounts align. Real-handler/SQLite/browser regression
  covers stale-cache data loss, fresh server props during a dirty edit, selection
  notes, retry, reanchor, reload/delete and delayed-save account isolation.
  Concurrent editors still use a whole-array last-write-wins API.

- Articles and PDFs with highlights, notes, search, boards, lists, and
  AI-assisted reading.
- Account-backed and device-local capture paths.
- Owned editorial product changelog at `/changelog`.
- HTML-only public sitemap with cataloged Markdown mirrors for agent discovery.
- Exact Ultracite-backed Biome presets with explicit local compatibility
  exceptions; `pnpm check` remains non-writing.
- One `pnpm quality` command reproduces the complete hosted code-health gate.

## Work queue

Open work is tracked only in [GitHub Issues](https://github.com/Significant-Hobbies/reader/issues).
An open issue is a to-do, a linked pull request is in progress, and merge plus
issue closure makes the work done.
