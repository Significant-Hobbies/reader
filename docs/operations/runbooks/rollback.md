# Runbook: Rollback a Deploy

Cloudflare Workers does not keep old Worker versions indefinitely, so rollback
is "redeploy a known-good commit." The deploy is manual
(`workflow_dispatch`), so rollback is also manual.

## Fast rollback (code)

1. Identify the last known-good commit on `main` (e.g. `git log main` and
   find the commit before the regression).
2. Check out that commit on a fresh branch:

   ```bash
   git checkout -b rollback/<date> <good-sha>
   ```

3. Run the deploy workflow on that branch, or locally:

   ```bash
   pnpm deploy
   ```

4. Smoke check: `curl --fail https://read.significanthobbies.com/` and log
   in to verify auth + library load.

## Rollback a schema migration

Only needed if a migration broke production. Additive migrations (the common
case) do not require rollback — old code ignores new tables/columns.

For a destructive migration that removed data:

1. Restore D1 through the rehearsed Cloudflare recovery procedure recorded in
   the migration receipt. During the Turso-to-D1 observation window, the
   preserved source database is the separate rollback authority.
2. Redeploy the matching known-good application code (above).
3. Verify with read-only D1 integrity and critical-journey checks.

Take a D1 export before any destructive migration in the future.

## Rollback a landing overlay change

The landing is built from `landing-astro/` and overlaid onto `dist/index.html`
during `cf:build`. If a landing change breaks `/`:

1. Revert the `landing-astro/` change on a branch.
2. Redeploy (`pnpm deploy`).

The SPA at `/app` is unaffected by landing-only changes.

## Rollback a config-only change (`wrangler.toml`)

`wrangler.toml` changes (bindings, routes, vars, placement) take effect on the
next `wrangler deploy`. To roll back, revert the file and redeploy.

**Caution:** removing a binding (e.g. `PDFS_BUCKET`) or changing the route
breaks production immediately. Revert and redeploy; do not edit `wrangler.toml`
in place on `main` without a smoke check.

## What you cannot roll back

- **R2 object deletes** — if a deploy deleted PDF objects, they are gone
  unless you have R2 replication or a bucket backup. Avoid `delete` calls in
  new code without a soft-delete path.
- **D1 row deletes** — restore through the rehearsed recovery procedure.
- **OAuth session invalidation** — rotating `BETTER_AUTH_SECRET` invalidates
  all sessions; users must sign in again. There is no rollback.

## Communication

For a production rollback, record the incident in SaaS Maker (per the fleet
guidance in `AGENTS.md`) and add a dated entry to
[knowledge/learnings.md](../../knowledge/learnings.md) if there is a durable
lesson.
