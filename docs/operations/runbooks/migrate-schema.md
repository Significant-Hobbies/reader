# Runbook: Apply a Drizzle Schema Change

Reader uses generated, additive migration SQL committed under `drizzle/` and
applied through Wrangler's D1 migration ledger. The Drizzle journal is
`drizzle/meta/_journal.json` with snapshots in `drizzle/meta/`.

## When to use this runbook

- You changed `src/lib/db/schema.ts` and need to apply the change.
- You are deploying a change that includes a new `drizzle/*.sql` migration
  (e.g. the RSS `0002_first_green_goblin.sql`).

## Local / dev

```bash
pnpm db:generate       # after editing the schema
pnpm db:migrate:local  # applies only to isolated local D1
```

`drizzle.config.ts` generates SQLite-compatible D1 migrations without database
credentials. `wrangler.local.toml` owns the isolated local binding.

## Production

1. **Read the migration SQL** under `drizzle/<NNNN>_<name>.sql`. Confirm it is
   additive (new tables, new columns with defaults, new indexes) and
   reversible by `DROP TABLE` / `DROP COLUMN` if needed.
2. **Apply the migration** before deploying application code that depends on
   it. For additive migrations the order is: migrate → deploy. For
   destructive migrations, deploy backward-compatible code first, then
   migrate, then remove the old code path.
3. **Apply via Wrangler only after explicit operator approval:**

   ```bash
   pnpm db:migrate:remote
   ```

4. **Verify** with an explicitly remote, read-only Wrangler D1 query and the
   migration receipt checks.
5. **Deploy** the application code per [deploy.md](../deploy.md).

## Example: the RSS migration

`drizzle/0002_first_green_goblin.sql` adds `rss_feeds` and `rss_entries`. It
is additive and reversible by dropping the two tables. Apply before deploying
the RSS routes. See [architecture/decisions/0008-rss-inbox.md](../../architecture/decisions/0008-rss-inbox.md).

## Rollback

- **Additive migration:** drop the new table/column/index. Data in the new
  table is disposable (e.g. RSS entries are transient inbox items).
- **Destructive migration:** restore through the separately rehearsed D1
  recovery plan. Take an export before any destructive change.

## Discipline

- Prefer additive migrations (new tables, new nullable columns, new indexes).
- Never use schema push against production; read generated SQL first.
