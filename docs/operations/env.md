# Environment Variables

Validated by `scripts/validate-env.mjs`. The script takes a mode argument
(`build` | `runtime` | `deploy`) and exits non-zero if any required variable
for that mode is missing or empty.

## Map

| Variable | Required where | Set via | Purpose |
| --- | --- | --- | --- |
| `DB` | runtime | `wrangler.toml` binding | Cloudflare D1 application and auth database |
| `BETTER_AUTH_SECRET` | runtime, deploy | Wrangler secret | better-auth session signing key (`openssl rand -base64 32`) |
| `BETTER_AUTH_URL` | — | `wrangler.toml [vars]` | OAuth callback base URL (prod: `https://read.significanthobbies.com`) |
| `GOOGLE_CLIENT_ID` | runtime, deploy | Wrangler secret | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | runtime, deploy | Wrangler secret | Google OAuth client secret |
| `AI_BASE_URL` | — | `wrangler.toml [vars]` | free-ai gateway URL (`https://ai-gateway.sassmaker.com/v1`) |
| `AI_GATEWAY_API_KEY` | runtime (free AI) | Wrangler secret | free-ai gateway bearer token (legacy alias `AI_API_KEY`) |
| `LOCAL_AI_URL` | optional | `.env.local` | Local AI bridge URL (default `http://127.0.0.1:3456`) |
| `CLI_BRIDGE_URL` | optional | `.env.local` | Legacy alias for `LOCAL_AI_URL` |
| `NODE_ENV` | — | `wrangler.toml [vars]` | `production` in prod; `development` enables local AI mode |
| `PDFS_BUCKET` | runtime | `wrangler.toml` binding | R2 bucket binding (`reader-pdfs`) |
| `ASSETS` | runtime | `wrangler.toml` binding | Static asset binding (`dist/`) |
| `CLOUDFLARE_ACCOUNT_ID` | deploy (CI) | GitHub secret | Wrangler deploy account |
| `CLOUDFLARE_API_TOKEN` | deploy (CI) | GitHub secret | Wrangler deploy token |
| `R2_ACCESS_KEY_ID` | local dev (R2) | `.env.local` | R2 S3-compat API (only if not using the binding) |
| `R2_SECRET_ACCESS_KEY` | local dev (R2) | `.env.local` | R2 S3-compat API |
| `R2_BUCKET_NAME` | local dev (R2) | `.env.local` | `reader-pdfs` |
| `VITE_POSTHOG_KEY` | optional | `.env.local` | PostHog analytics key (client) |
| `VITE_SAASMAKER_API_KEY` | optional | `.env.local` | SaaS Maker widget key (client) |
| `PLAYWRIGHT_BROWSERS_PATH` | optional | env | `0` for serverless Playwright |

## Validation modes

- `build` — no required vars (the build does not need runtime secrets).
- `runtime` — `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- `deploy` — same as `runtime`.

## Local dev

`.env.local` is loaded by `vite.config.ts` via `dotenv/config`. `.env.example`
is the committed template; `.env.local` is gitignored. The Worker dev server
(`pnpm dev:worker`) reads Wrangler secrets from `.dev.vars` (gitignored) and
isolated D1/R2 bindings from `wrangler.local.toml`.

## Security

- Never commit `.env`, `.env.local`, `.dev.vars`, `firebase-service-account.json`,
  or any auth credential. All are in `.gitignore`.
- BYOK provider keys (OpenAI/Anthropic/Gemini) live in the browser only —
  never sent to the server as env vars. See
  [architecture/decisions/0005-ai-gateway-byok.md](../architecture/decisions/0005-ai-gateway-byok.md).
- `rdr_*` API keys are hashed at rest; plaintext is shown once at creation. See
  [architecture/decisions/0006-mv3-side-panel.md](../architecture/decisions/0006-mv3-side-panel.md).

## Rotation

See [runbooks/rotate-secrets.md](runbooks/rotate-secrets.md).
