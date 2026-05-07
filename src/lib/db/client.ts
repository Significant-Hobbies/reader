import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

import * as schema from './schema';

type Database = ReturnType<typeof drizzle<typeof schema>>;

let cachedDb: Database | undefined;

function getDb(): Database {
  if (cachedDb) return cachedDb;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error('TURSO_DATABASE_URL is not set. Add it to .env.local.');
  }
  if (!authToken) {
    throw new Error('TURSO_AUTH_TOKEN is not set. Add it to .env.local.');
  }

  const client = createClient({ url, authToken });
  cachedDb = drizzle(client, { schema });
  return cachedDb;
}

export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
});
export { schema };
