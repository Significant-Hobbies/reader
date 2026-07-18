# Runbook: Apply a Drizzle Schema Change

Reader uses `drizzle-kit push` (`pnpm db:push`) for schema sync, with additive
migration SQL files committed under `drizzle/` for deliberate application in
production. The migration journal is `drizzle/meta/_journal.json` with
snapshots in `drizzle/meta/`.

## When to use this runbook

- You changed `src/lib/db/schema.ts` and need to apply the change.
- You are deploying a change that includes a new `drizzle/*.sql` migration
  (e.g. the RSS `0002_first_green_goblin.sql`).

## Local / dev

```bash
pnpm db:push        # drizzle-kit push → diffs schema.ts against the live DB and applies
```

`drizzle.config.ts` loads `.env.local` for `TURSO_DATABASE_URL` and
`TURSO_AUTH_TOKEN`. Push is schema-sync (no migration history); safe for a
single-user DB.

## Production

1. **Read the migration SQL** under `drizzle/<NNNN>_<name>.sql`. Confirm it is
   additive (new tables, new columns with defaults, new indexes) and
   reversible by `DROP TABLE` / `DROP COLUMN` if needed.
2. **Apply the migration** before deploying application code that depends on
   it. For additive migrations the order is: migrate → deploy. For
   destructive migrations, deploy backward-compatible code first, then
   migrate, then remove the old code path.
3. **Apply via Turso** (not `wrangler`):

   ```bash
   # Option A: drizzle-kit push against the production DB
   TURSO_DATABASE_URL=<prod url> TURSO_AUTH_TOKEN=<prod token> pnpm db:push

   # Option B: run the SQL file directly with the Turso CLI
   turso db shell <db-name> < drizzle/0002_first_green_goblin.sql
   ```

4. **Verify** with `pnpm db:studio` (read-only inspection) or a direct Turso
   query (`turso db shell <db-name> ".tables"`).
5. **Deploy** the application code per [deploy.md](../deploy.md).

## Example: the RSS migration

`drizzle/0002_first_green_goblin.sql` adds `rss_feeds` and `rss_entries`. It
is additive and reversible by dropping the two tables. Apply before deploying
the RSS routes. See [architecture/decisions/0008-rss-inbox.md](../../architecture/decisions/0008-rss-inbox.md).

## Rollback

- **Additive migration:** drop the new table/column/index. Data in the new
  table is disposable (e.g. RSS entries are transient inbox items).
- **Destructive migration:** restore from Turso backup (`turso db shell
  <db-name> ".restore <backup>"`). Take a backup before any destructive
  change.

## Discipline

- Prefer additive migrations (new tables, new nullable columns, new indexes).
- Avoid `drizzle-kit push` against production with data in an incompatible old
  shape — read the generated SQL first.
- Open question (tracked in STATUS.md): switch from `drizzle-kit push` to
  `drizzle-kit generate` for safer schema changes as user count grows. See
  [knowledge/learnings.md](../../knowledge/learnings.md).
