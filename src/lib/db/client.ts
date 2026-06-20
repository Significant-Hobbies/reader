import { createClient } from '@libsql/client/web';
import { drizzle } from 'drizzle-orm/libsql';

import * as schema from './schema';

export type DbEnv = {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN?: string;
};

export function createDb(env: DbEnv) {
  const url = env.TURSO_DATABASE_URL;
  const httpUrl = url.replace(/^libsql:\/\//, 'https://');
  const client = createClient({
    url: httpUrl,
    authToken: env.TURSO_AUTH_TOKEN,
  });
  return drizzle(client, { schema });
}

type Database = ReturnType<typeof createDb>;

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

  cachedDb = createDb({ TURSO_DATABASE_URL: url, TURSO_AUTH_TOKEN: authToken });
  return cachedDb;
}

export function setDb(db: Database) {
  cachedDb = db;
}

export const db = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb() as object, prop, receiver);
  },
});

export { schema };
