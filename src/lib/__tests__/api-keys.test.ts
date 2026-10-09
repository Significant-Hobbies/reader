import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../db/client', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const { drizzle } = await import('drizzle-orm/sqlite-proxy');
  const { getTableConfig } = await import('drizzle-orm/sqlite-core');
  const { apiKeys } = await import('../db/schema');
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(
    `CREATE TABLE api_keys (${getTableConfig(apiKeys)
      .columns.map(
        (column) => `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}`
      )
      .join(', ')})`
  );
  return {
    db: drizzle(async (query, params) => {
      const statement = sqlite.prepare(query);
      statement.setReturnArrays(true);
      return { rows: statement.all(...(params as (string | number | null)[])) };
    }),
  };
});
import { db } from '../db/client';
import { apiKeys } from '../db/schema';
import { generateApiKey, verifyApiKey } from '../api-keys';
import { eq } from 'drizzle-orm';
beforeEach(async () => {
  await db.delete(apiKeys);
});
it('stores a hash, maps a valid token to its owner, and rejects it after revocation', async () => {
  const key = generateApiKey();
  expect(key.hash).not.toContain(key.plaintext);
  expect(key.plaintext).toMatch(/^rdr_[A-Za-z0-9_-]{32}$/u);
  await db.insert(apiKeys).values({
    id: 'one',
    userId: 'alice',
    name: 'Fixture',
    prefix: key.prefix,
    tokenHash: key.hash,
    createdAt: new Date(),
  });
  expect(await verifyApiKey(key.plaintext)).toBe('alice');
  expect(await verifyApiKey('rdr_synthetic-invalid')).toBeNull();
  await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, 'one'));
  expect(await verifyApiKey(key.plaintext)).toBeNull();
});
