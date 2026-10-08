# AGENTS.md — Reader

> Agent bootloader. Concise by design — links to [`docs/`](docs/index.md) for
> depth. This repository is independently operable: its tracked instructions
> and commands are authoritative, no sibling Fleet checkout is required, and
> durable follow-up belongs in this repository's GitHub Issues.

## Purpose

Reader is a personal research library: capture web articles and PDFs, read and
annotate them, organise with tags/lists/boards, search, and AI-chat or
auto-summarise the saved material. Companion Chrome MV3 extension. See
[docs/product/overview.md](docs/product/overview.md).

## Stack (one-liner)

Vite + React 19 SPA (single `app.html` entry) + Hono Worker on Cloudflare
Workers (`src/worker.ts`), Cloudflare D1 via Drizzle ORM, better-auth Google
OAuth, Cloudflare R2 for PDFs, free-ai-gateway + BYOK + local-ai dev bridge.
No SSR, no Next.js, no Firebase.

## Essential commands

```bash
pnpm install
pnpm dev              # Worker (:8787) + Vite SPA (:5173) + local-ai, concurrently
pnpm dev:worker       # wrangler dev only
pnpm dev:spa          # vite only (proxies /api → 8787)
pnpm build            # validate env + vite build → dist/
pnpm cf:build         # build + landing-astro + overlay into dist/
pnpm deploy           # validate env + cf:build + wrangler deploy (manual; CI does not auto-deploy)
pnpm typecheck        # tsc --noEmit (app + worker tsconfigs)
pnpm test             # vitest run
pnpm quality          # complete local/CI code-health gate
pnpm test:e2e         # playwright
pnpm lint             # biome check .
pnpm format           # biome format --write .
pnpm db:generate      # generate a tracked D1 migration
pnpm db:migrate:local # apply migrations to isolated local D1
pnpm docs:check       # validate docs/ links + structure
```

Chrome extension (separate workspace, excluded from root tooling):
`cd packages/chrome-extension && pnpm dev|build|test`.

Full command map: [docs/development/commands.md](docs/development/commands.md).

## Critical constraints

- **Do not commit secrets.** `.env`, `.env.local`, `.dev.vars`,
  `firebase-service-account.json`, and any auth credential are gitignored.
  Verify `.gitignore` before any push.
- **Do not deploy or run migrations without explicit user approval.**
  Commit and push safe changes.
- **Production deploy is manual** (`workflow_dispatch` on
  `.github/workflows/deploy.yml`). CI runs on push but does not deploy.
- **The Worker name `reader` is load-bearing** — the custom domain
  (`read.significanthobbies.com`) and all Cloudflare secrets are bound to it.
  Do not rename without re-provisioning.
- **`wrangler.toml` `run_worker_first` list is required** for agent surfaces
  and `/api/*` to reach the Worker before the `ASSETS` binding.
- **BYOK provider keys live in the browser only** — never persist or log
  server-side. `rdr_*` API keys are hashed at rest; plaintext shown once.
- **Schema changes are additive + deliberate.** Generate and inspect SQL before applying it;
  read the SQL under `drizzle/` before applying to production. See
  [docs/operations/runbooks/migrate-schema.md](docs/operations/runbooks/migrate-schema.md).
- **Pre-commit hook (Husky + lint-staged)** runs `biome check --write` on
  staged `*.{js,jsx,ts,tsx,json,css}`. Re-stage modified files and retry if
  the hook reformats.
- **Do not modify agent skills, plugins, or agent-profile directories**
  (`.claude/`, `.codex/skills/`, `.symphony/`, `.clawpatch/`, any `SKILL.md`).
  They are tooling, not product code.

## Documentation

- **[docs/index.md](docs/index.md)** is the canonical hub: layout, section
  map, and the documentation-maintenance rules (one home per fact, archive
  instead of delete, keep pages 150-300 lines). Start there.
- [PROJECT_STATUS.md](PROJECT_STATUS.md) is current/shipped product truth.
  Open, blocked, and deferred work lives in
  [GitHub Issues](https://github.com/Significant-Hobbies/reader/issues).
- Run `pnpm docs:check` before committing doc changes (CI runs it too).
- Runtime agent-indexing surfaces are in [public/](public/); see
  [docs/product/surfaces.md](docs/product/surfaces.md).

## Repo structure (high level)

```
app.html                  # Single SPA HTML entry (Vite input)
vite.config.ts            # Vite SPA build (React, Tailwind v4, Lightning CSS)
wrangler.toml             # Worker config: main=src/worker.ts, ASSETS + PDFS_BUCKET
src/
  worker.ts               # Hono Worker entry — security headers, /api/* routing, asset serving
  agent-edge.mjs          # Generated agent-edge handler (llms.txt, index.md, api/ai)
  worker/routes/          # Hono API route modules (articles, boards, lists, ai, keys, pdf, rss, share, memories, misc)
  pages/                  # Route page components (lazy-loaded via react-router-dom)
  components/             # React components (ReaderView, PDFReaderClient, NotesAIChat, board/, reader/, ui/)
  hooks/                  # Shared React hooks
  lib/                    # DB, auth, AI, storage, SSRF validation, RSS, memories, etc.
packages/chrome-extension/ # Chrome MV3 extension (separate Vite build)
landing-astro/            # Astro landing page (overlaid into dist/ during cf:build)
docs/                     # Canonical documentation (source of truth)
drizzle/                  # Migration SQL files + meta
scripts/                  # local-ai.mjs, validate-env.mjs, overlay-astro-landing.mjs, check-docs.mjs
public/                   # Agent-indexing surfaces (llms.txt, index.md, api-ai.json, robots.txt, sitemap.xml)
```

Detailed file map: [docs/architecture/overview.md](docs/architecture/overview.md).

## Fleet guidance

<!-- FLEET-GUIDANCE:START -->

### Adding Tasks

- Track Reader work in this repository's GitHub Issues.
- Keep reusable cross-project automation in `saas-maker/tooling/` and private
  portfolio metadata in Site Health, not SaaS Maker.

### Using SaaS Maker

- Do not use the retired SaaS Maker task queue or API as a system of record.
- Site Health owns private portfolio metadata; `saas-maker/tooling/` owns shared
  automation. Reader remains independently versioned and deployed.

### Free AI First

- Prefer free/local AI paths for routine development and analysis: the
  `free-ai` gateway, local models, provider free tiers, and cached context.
- Escalate to paid models only when complexity, correctness risk, or missing
  capability justifies the cost.
- Note any paid-AI use in the task or handoff when it materially affects cost,
  reproducibility, or future maintenance.

<!-- FLEET-GUIDANCE:END -->
