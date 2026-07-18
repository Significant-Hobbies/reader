# Deploy

Reader deploys to Cloudflare Workers as the `reader` Worker with a custom
domain `read.significanthobbies.com`. Production deploys are **manual**
(`workflow_dispatch` on `.github/workflows/deploy.yml`) — there is no
auto-deploy on push to `main` (CI runs on push, deploy does not).

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
- `[placement] mode = "smart"` (co-locate Worker with Turso)
- `[observability] enabled = true, head_sampling_rate = 0.1`
- `[limits] cpu_ms = 30000`
- `[[r2_buckets]] binding = "PDFS_BUCKET", bucket_name = "reader-pdfs"`
- `[vars] AI_BASE_URL`, `BETTER_AUTH_URL`, `NODE_ENV = "production"`

## Required Cloudflare secrets

Set via `wrangler secret put <NAME>`:

- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `TURSO_AUTH_TOKEN`
- `TURSO_DATABASE_URL`
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

`.github/workflows/deploy.yml` has a `deploy-preview` job that runs on PRs
(`pnpm cf:build` only, no deploy). It validates the build is green without
pushing to production.

## Rollback

See [runbooks/rollback.md](runbooks/rollback.md).
