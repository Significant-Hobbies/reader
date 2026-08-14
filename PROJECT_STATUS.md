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
