import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { createDb, setDb, type DbEnv } from '../src/lib/db/client';
import articleRoutes from '../src/worker/routes/articles';
import boardRoutes from '../src/worker/routes/boards';

export function accountFixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('drizzle/0000_baseline.sql', 'utf8'));
  const binding = {
    prepare(sql: string) {
      const statement = sqlite.prepare(sql);
      return {
        bind(...values: (string | number | null)[]) {
          return {
            async raw() {
              const columns = statement.columns().map((column) => column.name);
              return statement.all(...values).map((row) => columns.map((column) => row[column]));
            },
            async all() {
              return { results: statement.all(...values) };
            },
            async run() {
              return { success: true, meta: statement.run(...values) };
            },
          };
        },
      };
    },
  };
  setDb(createDb({ DB: binding as unknown as DbEnv['DB'] }));
  for (const user of ['alice', 'bob']) {
    sqlite
      .prepare('INSERT INTO user (id, name, email) VALUES (?, ?, ?)')
      .run(user, user, `${user}@example.invalid`);
    sqlite
      .prepare(
        "INSERT INTO articles (id, user_id, url, title, type, notes, pdf_storage_key) VALUES (?, ?, ?, ?, 'pdf', '[]', ?)"
      )
      .run(
        `${user}-pdf`,
        user,
        'https://example.invalid/synthetic.pdf',
        `${user} synthetic PDF`,
        `synthetic/${user}.pdf`
      );
  }
  const app = new Hono().route('/api/articles', articleRoutes).route('/api/boards', boardRoutes);
  return { sqlite, app };
}
