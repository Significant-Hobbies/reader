# Development Setup

## Prerequisites

- Node.js 22+ (engines field in `package.json`; CI uses 24).
- pnpm 10+ (the `packageManager` field pins the exact version).
- A Turso database (`turso db create`) and auth token.
- A Cloudflare account with an R2 bucket `reader-pdfs` bound as `PDFS_BUCKET`.
- A Google OAuth client (Google Cloud Console → APIs & Services → Credentials)
  with a redirect URI for `BETTER_AUTH_URL` (e.g.
  `http://localhost:8787/api/auth/callback/google` in dev).

## Install

```bash
pnpm install
```

## Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` (see [operations/env.md](../operations/env.md) for the full
list and validation):

- `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`
- `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `BETTER_AUTH_URL`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `AI_GATEWAY_API_KEY` (free-ai gateway) — optional for BYOK-only dev
- `LOCAL_AI_URL` (optional; defaults to `http://127.0.0.1:3456`)

R2 credentials are only needed for production / `wrangler dev`; the binding
itself is provided by `wrangler dev` from `wrangler.toml`.

## Push the schema

```bash
pnpm db:push        # drizzle-kit push → applies schema to Turso
```

See [operations/runbooks/migrate-schema.md](../operations/runbooks/migrate-schema.md)
for migration discipline.

## Run

```bash
pnpm dev            # Worker (wrangler dev, :8787) + Vite SPA (:5173) + local-ai, concurrently
```

- Worker-served app: `http://localhost:8787`
- Vite SPA only (proxies `/api` → 8787): `http://localhost:5173`
- Local AI providers are shown only in development mode.

If you only need the SPA:

```bash
pnpm dev:spa
```

If you only need the Worker:

```bash
pnpm dev:worker
```

## Chrome extension (separate workspace)

```bash
cd packages/chrome-extension
pnpm install
pnpm dev            # vite build --watch → dist/
```

Then in Chrome: `chrome://extensions` → enable Developer mode → **Load
unpacked** → select `packages/chrome-extension/dist`. See
`packages/chrome-extension/README.md`.

## Landing page (Astro overlay)

```bash
pnpm --filter ./landing-astro dev
```

The landing is overlaid onto `dist/index.html` during `cf:build` — see
[operations/deploy.md](../operations/deploy.md).

## Common commands

See [commands.md](commands.md) for the full script map. The essentials:

```bash
pnpm typecheck     # tsc --noEmit (app + worker tsconfigs)
pnpm test          # vitest run
pnpm test:e2e      # playwright
pnpm lint          # biome check .
pnpm format        # biome format --write .
pnpm docs:check    # validate docs/ links + structure (see scripts/check-docs.mjs)
```
