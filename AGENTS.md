# AGENTS.md — Reader

> Agent bootloader. Concise by design — links to [`docs/`](docs/index.md) for
> depth. This repository is independently operable: its tracked instructions
> and commands are authoritative, no sibling Fleet checkout is required, and
> durable follow-up belongs in this repository's GitHub Issues.

## Purpose

Reader is a saved-link inbox. Add URLs in the app or Chrome extension; ChatGPT retrieves links and available text and marks them read through MCP. See [docs/product/overview.md](docs/product/overview.md).

## Stack

Vite + React SPA, Hono Cloudflare Worker, D1 via Drizzle, better-auth Google sign-in, and Auth0-backed MCP OAuth. The existing D1 schema and R2 data are preserved. There is no built-in AI, reader, PDF capture, RSS, board, or annotation workflow.

## Essential commands

```bash
pnpm install
pnpm dev              # Worker (:8787) + Vite SPA (:5173), concurrently
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
- **`rdr_*` API keys are hashed at rest; plaintext shown once.** MCP reads require `reader.read`; read-state writes require `reader.write`. Never treat a browser cookie as an MCP credential.
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

## Active source

- `src/components/HomeClient.tsx`: inbox, URL form, and read-state changes.
- `src/components/ExtensionConnectClient.tsx`: connections and extension keys.
- `src/lib/links-db.ts`: account-scoped link storage over the existing articles table.
- `src/lib/link-content.ts`: bounded web-text retrieval.
- `src/worker/routes/`: links, MCP, keys, and account identity.
- `packages/chrome-extension/`: popup-only URL/title capture.
- `landing-astro/`: landing overlay.

MCP setup and the live verification boundary are in [docs/architecture/overview.md](docs/architecture/overview.md). Legacy schema columns and tables are retained deliberately; do not drop saved data as cleanup.

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
