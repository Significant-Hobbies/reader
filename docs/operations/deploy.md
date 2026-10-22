# Deploy

Reader deploys to Cloudflare Workers as the `reader` Worker with a custom
domain `read.significanthobbies.com`. Cloudflare Workers Builds publishes
`main` automatically; a merge is a production release. Follow the owner's
release authorization policy before merging. PR builds upload preview
versions without changing the active production deployment.

The GitHub `deploy.yml` workflow is a separate explicit publisher
(`workflow_dispatch`). It tags the uploaded version with the full commit SHA.
After either path, verify the active Worker version and traffic allocation,
then exercise the live flow. A successful build alone does not verify release.

## Pipeline

```
pnpm deploy
  → pnpm validate:env:deploy        (scripts/validate-env.mjs deploy)
  → pnpm cf:build
      → pnpm build                  (validate-env(build) + vite build → dist/)
      → pnpm --filter ./landing-astro build
      → node scripts/overlay-astro-landing.mjs   (overlay landing → dist/index.html, merge _headers)
  → pnpm exec wrangler deploy
```

The Worker `main` is `src/worker.ts`; built assets in `dist/` are served via
the `ASSETS` binding. `wrangler.toml` configures:

- `compatibility_date = "2025-04-01"`, `compatibility_flags = ["nodejs_compat_v2"]`
- `assets = { directory = "dist", binding = "ASSETS", run_worker_first = ["/sitemap.xml", "/index.md", "/llms-full.txt", "/llms.txt", "/api/*", "/"] }`
- `routes = [{ pattern = "read.significanthobbies.com", custom_domain = true }]`
- `[placement] mode = "smart"`
- `[observability] enabled = true, head_sampling_rate = 0.1`
- `[limits] cpu_ms = 30000`
- `[[r2_buckets]] binding = "PDFS_BUCKET", bucket_name = "reader-pdfs"`
- `[[d1_databases]] binding = "DB"` after the approved production cutover
- `[vars] AI_BASE_URL`, `BETTER_AUTH_URL`, `NODE_ENV = "production"`

## Required Cloudflare secrets

Set via `wrangler secret put <NAME>`:

- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AI_GATEWAY_API_KEY` (free-ai gateway; legacy alias `AI_API_KEY`)

The deploy workflow validates that each required secret exists in
`wrangler secret list` before building. See
[env.md](env.md) for the full env map and [runbooks/rotate-secrets.md](runbooks/rotate-secrets.md)
for rotation.

## Landing overlay

`scripts/overlay-astro-landing.mjs` copies `landing-astro/dist/*` over
`dist/`, **except** protected prefixes (`assets/`, `app.html`). `_headers` is
merged (Astro headers first, then Vite build headers). The SPA lives at
`dist/app.html` and is served at `/app`; the landing lives at
`dist/index.html` and is served at `/`.

If `landing-astro/dist` is missing, the overlay step warns and skips — the
SPA-only build is still deployable.

## Smoke check

The deploy workflow runs:

```bash
curl --fail --silent --show-error --retry 3 --retry-delay 5 --max-time 20 \
  https://read.significanthobbies.com/ > /dev/null
```

A non-200 aborts the workflow.

## Preview deploys

Cloudflare Workers Builds uploads PR preview versions. The GitHub deploy
workflow also defines a build-only `deploy-preview` job, but its manual-only
trigger means that job does not currently run on PRs. See [ci-cd.md](ci-cd.md).

## Rollback

See [runbooks/rollback.md](runbooks/rollback.md).
