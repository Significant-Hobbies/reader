# ADR-0004: better-auth (Google OAuth via Drizzle Adapter)

**Date:** 2026-04-25 (replaced Firebase Auth; brief Auth.js v5 detour settled on better-auth)
**Status:** Current
**Supersedes:** [archive/decisions.md ADR-05](../../archive/decisions.md)

## Context

Firebase Auth was removed as part of the migration off Firebase. The original
plan (`archive/plans-migrate-off-firebase.md`) targeted Auth.js v5
(`next-auth@beta`) with the libSQL adapter; at cutover `better-auth` was chosen
instead because of its first-party Drizzle adapter.

## Decision

Use `better-auth` v1.6 with its Drizzle adapter, Google OAuth only.

- Server config: `src/lib/auth.ts` (`createAuth(env)`). Reads
  `BETTER_AUTH_SECRET` (falls back to `AUTH_SECRET`), `BETTER_AUTH_URL`
  (falls back to `BETTER_AUTH_BASE_URL`, then the production URL), and the
  Google client credentials from `env`.
- Browser client: `src/lib/auth-client.ts`.
- Handler: mounted as a Hono catch-all in `src/worker.ts` —
  `api.on(['GET','POST'], '/api/auth/*', ...)` returns `auth.handler(c.req.raw)`.
- Plugins: `oneTap()` (Google One Tap sign-in).
- Rate limiting: **disabled** (`rateLimit: { enabled: false }`). Open question:
  revisit if the app becomes public. Tracked in STATUS.md.
- Auth resolution for API routes: `getAuthenticatedUserId()` in
  `src/lib/auth-api.ts` accepts either a `Bearer rdr_*` API key (extension) or
  a session cookie (webapp). See [../data-flow.md](../data-flow.md).

## Rationale

- First-party Drizzle adapter on the same Turso DB; no second data store.
- `oneTap()` plugin gives Google One Tap sign-in with no extra wiring.
- Hono catch-all forwards the raw `Request` to `auth.handler`, preserving
  multiple `Set-Cookie` headers (the OAuth callback sets session token + state
  clear in one response — see the comment in `src/worker.ts`).

## Tradeoffs

- Legacy NextAuth tables (`account`, `session`, `verificationToken`) remain in
  `src/lib/db/schema.ts` as unused remnants from the Auth.js detour. Safe to
  drop after confirming no active rows. Open question, tracked in STATUS.
- `BETTER_AUTH_SECRET` must be set as a Wrangler secret; in non-production
  builds `createAuth` falls back to a hardcoded dev string to avoid blocking
  the build.
- Rate limiting disabled — acceptable for single-user scale; revisit before
  any public launch.

## Alternatives considered

- **Auth.js (NextAuth) v5:** original plan-doc choice; `better-auth` chosen at
  cutover for the Drizzle adapter.
- **Firebase Auth:** removed — the point of the migration.
- **Clerk / Auth0:** third-party managed; adds cost and an external dependency.
