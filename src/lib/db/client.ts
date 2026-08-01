import { drizzle } from 'drizzle-orm/d1';

import * as schema from './schema';

export type DbEnv = {
  DB: Parameters<typeof drizzle>[0];
};

export function createDb(env: DbEnv) {
  return drizzle(env.DB, { schema });
}

type Database = ReturnType<typeof createDb>;

let cachedDb: Database | undefined;

function getDb(): Database {
  if (!cachedDb) throw new Error('D1 database binding has not been initialized for this request.');
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
