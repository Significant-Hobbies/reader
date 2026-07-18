# Scheduled Jobs

The only scheduled job is the GitHub Actions weekly quality check.

## Weekly Quality Check

- **Workflow:** `.github/workflows/weekly.yml`
- **Schedule:** `cron: '0 9 * * 1'` (Mondays 09:00 UTC) + `workflow_dispatch`
  for manual runs.
- **What it does:** checkout → Node 22 → corepack/pnpm → install
  (`--frozen-lockfile --ignore-scripts`) → run `lint`, `typecheck`, `test`,
  `build` scripts if present in `package.json`.
- **Why:** catches drift that doesn't surface on push CI (e.g. dependency
  regressions, environment drift, weekly quality baseline).
- **Permissions:** `contents: read` only.

## Other workflows (manual, not scheduled)

- `deploy.yml` — `workflow_dispatch` only. See [ci-cd.md](ci-cd.md).
- `review.yaml` — `workflow_dispatch` only (AI code review).
- `docs.yml` — push/PR-triggered + `workflow_dispatch`.

## Cloudflare Workers scheduled triggers

**None configured.** `wrangler.toml` has no `[triggers] crons` entry. RSS
refresh is manual (`POST /api/rss/refresh`) by design — see
[architecture/decisions/0008-rss-inbox.md](../architecture/decisions/0008-rss-inbox.md).
Background refresh via Cloudflare scheduled triggers is deferred until manual
use demonstrates the need.

## Local AI bridge

`scripts/local-ai.mjs` is a dev-only bridge (`pnpm local-ai`); it spawns
`../local-ai/index.mjs` (or legacy `../cli-bridge/index.mjs`) and is not a
scheduled job.
