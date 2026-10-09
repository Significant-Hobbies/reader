import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('../db/client', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const { drizzle } = await import('drizzle-orm/sqlite-proxy');
  const { getTableConfig } = await import('drizzle-orm/sqlite-core');
  const { articles } = await import('../db/schema');
  const sqlite = new DatabaseSync(':memory:');
  const columns = getTableConfig(articles).columns;
  sqlite.exec(
    `CREATE TABLE articles (${columns.map((column) => `"${column.name}" ${column.getSQLType()}${column.primary ? ' PRIMARY KEY' : ''}`).join(', ')})`
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
import { articles } from '../db/schema';
import { addLink, getLink, listLinks, normalizeLinkUrl, setLinkRead } from '../links-db';

beforeEach(async () => {
  await db.delete(articles);
});

it('deduplicates URLs within an account, strips fragments, and isolates accounts', async () => {
  const first = await addLink('alice', { url: 'https://example.com/post#one', title: 'A post' });
  const duplicate = await addLink('alice', { url: 'https://example.com/post#two' });
  const other = await addLink('bob', { url: 'https://example.com/post' });
  expect(duplicate).toEqual({ id: first.id, existing: true });
  expect(other.id).not.toBe(first.id);
  expect(await getLink('bob', first.id)).toBeNull();
  expect(await setLinkRead('bob', first.id, true)).toBeNull();
});

it('lists unread items, handles literal search punctuation, and persists read/unread state', async () => {
  const first = await addLink('alice', { url: 'https://example.com/a', title: '100%_ready' });
  await addLink('alice', { url: 'https://example.com/b', title: '100xxready' });
  await setLinkRead('alice', first.id, true);
  expect((await listLinks('alice', { status: 'unread' })).total).toBe(1);
  expect((await listLinks('alice', { status: 'read' })).items[0].id).toBe(first.id);
  expect((await listLinks('alice', { query: '%_' })).total).toBe(1);
  await setLinkRead('alice', first.id, false);
  expect((await getLink('alice', first.id))?.status).toBe('unread');
});

it('paginates deterministically without dropping items and retains legacy web content', async () => {
  for (let i = 0; i < 4; i++) await addLink('alice', { url: `https://example.com/${i}` });
  const first = await listLinks('alice', { limit: 2 });
  const second = await listLinks('alice', { limit: 2, offset: first.nextOffset! });
  expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(4);
  expect(second.nextOffset).toBeNull();
  await db.insert(articles).values({
    id: 'legacy',
    userId: 'alice',
    url: 'https://example.com/old',
    title: 'Old article',
    content: '<p>Saved text</p>',
    type: 'article',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  expect((await getLink('alice', 'legacy'))?.storedContent).toBe('<p>Saved text</p>');
  await setLinkRead('alice', 'legacy', true);
  expect((await getLink('alice', 'legacy'))?.storedContent).toBe('<p>Saved text</p>');
});

it('rejects credentials, non-web schemes, and oversized URLs', () => {
  for (const url of [
    'file:///tmp/x',
    'javascript:alert(1)',
    'https://user:password@example.com',
    'x'.repeat(4097),
  ]) {
    expect(() => normalizeLinkUrl(url)).toThrow();
  }
});
