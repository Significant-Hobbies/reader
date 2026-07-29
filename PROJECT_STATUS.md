# PROJECT_STATUS — Reader

> **Pointer.** The canonical current-state view is now
> [`STATUS.md`](STATUS.md). This file is kept for fleet tooling that reads
> `PROJECT_STATUS.md` by name (e.g. the `name-domains` skill). For the full
> product/feature/architecture record, see [`docs/`](docs/index.md).
>
> Last substantive content: 2026-07-13 (RSS reader shipped). Superseded by
> STATUS.md on 2026-07-18.

## At-a-glance

- **Product:** Reader — personal research library (capture, read, annotate,
  AI-chat over articles and PDFs) + Chrome MV3 extension.
- **Production:** `https://read.significanthobbies.com` (Cloudflare Worker
  `reader`, custom domain).
- **Stack:** Vite + React 19 SPA + Hono Worker · Turso (libSQL) + Drizzle ·
  better-auth Google OAuth · Cloudflare R2 (`PDFS_BUCKET`) · free-ai-gateway
  + BYOK + local-ai dev bridge.
- **Posture:** Personal-use support (closure 2026-07-10). Maintenance and
  reliability only; no roadmap expansion.
- **Open work:** [GitHub Issues](https://github.com/Significant-Hobbies/reader/issues).
- **Detailed docs:** see [docs/index.md](docs/index.md).

## Work queue

Open work is tracked only in [GitHub Issues](https://github.com/Significant-Hobbies/reader/issues).
An open issue is a to-do, a linked pull request is in progress, and merge plus
issue closure makes the work done.
