# ADR-0010: Cloudflare D1 for structured data

**Status:** Accepted for migration; production cutover remains operator-gated.

## Decision

Use one Cloudflare D1 database, bound as `DB`, for Reader's application and
better-auth tables. Keep Drizzle as the query and schema layer. Generate tracked
SQLite migrations and apply them through Wrangler's D1 migration ledger.

Local development uses the isolated binding in `wrangler.local.toml`. Remote
resource creation, data import, production binding, deployment, and Turso
retirement are separate approved operations.

## Why

Reader already runs as a Cloudflare Worker and stores PDFs in R2. D1 removes
the external libSQL client and database credentials from each request while
keeping the existing SQLite schema and Drizzle query surface.

## Consequences

- `src/lib/db/client.ts` receives a request-scoped D1 binding.
- Better Auth and all application tables remain in the same database.
- The legacy Firestore import is local by default and requires both `--apply`
  and `--remote` before it can write remotely.
- Production Turso remains the authority until parity checks and explicit
  cutover approval pass; its retirement is not implied by cutover.
