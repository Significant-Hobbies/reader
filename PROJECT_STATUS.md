# PROJECT_STATUS — Reader

> **Pointer.** The canonical current-state view is now
> [`STATUS.md`](STATUS.md). This file is kept for fleet tooling that reads
> `PROJECT_STATUS.md` by name (e.g. the `name-domains` skill). For the full
> product/feature/architecture record, see [`docs/`](docs/index.md).

## Why / What

Reader is a personal research library for capturing, reading, annotating, and
AI-assisted work over saved articles and PDFs. It remains in personal-use,
maintenance-first support.

## Dependencies

- Vite + React 19 SPA, Hono Worker, Turso + Drizzle, Cloudflare R2, better-auth
  Google OAuth, and optional AI providers.

## Timeline

- **2026-07-31:** Kept the public sitemap HTML-only and added source-level
  sitemap/catalog/Markdown parity coverage.
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

- Articles and PDFs with highlights, notes, search, boards, lists, and
  AI-assisted reading.
- Account-backed and device-local capture paths.
- Owned editorial product changelog at `/changelog`.
- HTML-only public sitemap with cataloged Markdown mirrors for agent discovery.

## Work queue

Open work is tracked only in [GitHub Issues](https://github.com/Significant-Hobbies/reader/issues).
An open issue is a to-do, a linked pull request is in progress, and merge plus
issue closure makes the work done.
