# Runbook: Rotate Secrets

Rotate on a schedule, after a suspected leak, or when personnel changes. The
production Worker reads secrets from Cloudflare Workers secrets
(`wrangler secret list`); Turso and Google OAuth have their own consoles.

## Cloudflare Worker secrets

```bash
wrangler secret put BETTER_AUTH_SECRET        # openssl rand -base64 32
wrangler secret put TURSO_AUTH_TOKEN          # from Turso console
wrangler secret put GOOGLE_CLIENT_SECRET      # from Google Cloud Console
wrangler secret put AI_GATEWAY_API_KEY        # from free-ai gateway
```

`BETTER_AUTH_URL`, `AI_BASE_URL`, and `NODE_ENV` are not secrets — they live
in `wrangler.toml [vars]`. `GOOGLE_CLIENT_ID` is technically a secret in this
project (the deploy workflow checks for it) but is also safe to commit as a
var if you prefer; current convention keeps it as a secret.

After rotating `BETTER_AUTH_SECRET`, existing sessions are invalidated — users
must sign in again. There is only one production user today, so this is a
non-event.

## Turso

1. Turso console → database → Tokens → create a new token.
2. `wrangler secret put TURSO_AUTH_TOKEN` with the new value.
3. Revoke the old token in the Turso console once the new one is live.

## Google OAuth

1. Google Cloud Console → APIs & Services → Credentials → your OAuth client.
2. Reset the client secret (or create a new client).
3. `wrangler secret put GOOGLE_CLIENT_SECRET` with the new value.
4. Update the authorised redirect URI if you changed the client
   (`BETTER_AUTH_URL/api/auth/callback/google`).

## free-ai gateway

1. Generate a new gateway key (`openssl rand -hex 32`).
2. Update the gateway Worker's secret and any other fleet consumers.
3. `wrangler secret put AI_GATEWAY_API_KEY` (legacy alias `AI_API_KEY`) with
   the new value.

## R2

R2 access for local dev uses `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` in
`.env.local` (gitignored). Rotate via the Cloudflare dashboard → R2 → Manage
R2 API tokens. The production Worker uses the native `PDFS_BUCKET` binding,
not the S3-compat API keys, so R2 key rotation does not affect production.

## Verify

```bash
pnpm validate:env:deploy        # confirms required env vars are present locally
wrangler secret list            # confirms each secret is set on the Worker
```

The deploy workflow (`.github/workflows/deploy.yml`) re-checks
`wrangler secret list` for each required secret before building.

## After rotation

No redeploy is required for secret-only changes — Workers pick up new secret
values on the next request. For `BETTER_AUTH_SECRET` rotation, the next
request that signs a session uses the new key; old sessions fail validation
and the user is prompted to sign in again.
