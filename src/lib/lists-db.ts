import crypto from 'crypto';
import { and, desc, eq } from 'drizzle-orm';

import type { List } from '../types';
import { sanitizePlainText } from './articles-db';
import { db } from './db/client';
import { articles, lists } from './db/schema';

export function favouritesListId(userId: string): string {
  return `${userId}_favourites`;
}

export function readLaterListId(userId: string): string {
  return `${userId}_read-later`;
}

function isDefaultListId(id: string): boolean {
  return id.endsWith('_favourites') || id.endsWith('_read-later');
}

function parseJsonColumn<T>(raw: unknown, fallback: T): T {
  if (raw == null || raw === '') return fallback;
  if (typeof raw !== 'string') return raw as T;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error('lists-db: failed to parse json column', error);
    return fallback;
  }
}

function serializeJsonColumn(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.error('lists-db: failed to serialize json column', error);
    return null;
  }
}

function toIso(value: Date | number | null | undefined): string | undefined {
  if (value == null) return undefined;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

type ListRow = typeof lists.$inferSelect;

function normalizeIcon(icon: unknown): 'heart' | 'clock' | 'dot' | undefined {
  return icon === 'heart' || icon === 'clock' || icon === 'dot' ? icon : undefined;
}

function rowToList(row: ListRow): List {
  return {
    id: row.id,
    name: row.name,
    userId: row.userId,
    color: row.color ?? undefined,
    icon: normalizeIcon(row.icon),
    isDefault: row.isDefault === 1,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

async function upsertDefaultList(params: {
  id: string;
  userId: string;
  name: string;
  icon: 'heart' | 'clock';
}): Promise<ListRow> {
  const existing = await db.select().from(lists).where(eq(lists.id, params.id)).limit(1);
  if (existing[0]) return existing[0];

  const now = new Date();
  await db.insert(lists).values({
    id: params.id,
    userId: params.userId,
    name: params.name,
    icon: params.icon,
    isDefault: 1,
    createdAt: now,
    updatedAt: now,
  });

  const rows = await db.select().from(lists).where(eq(lists.id, params.id)).limit(1);
  return rows[0];
}

export async function ensureDefaultLists(userId: string): Promise<List[]> {
  try {
    const favouritesRow = await upsertDefaultList({
      id: favouritesListId(userId),
      userId,
      name: 'Favourites',
      icon: 'heart',
    });
    const readLaterRow = await upsertDefaultList({
      id: readLaterListId(userId),
      userId,
      name: 'Read Later',
      icon: 'clock',
    });
    return [rowToList(favouritesRow), rowToList(readLaterRow)];
  } catch (error) {
    console.error('lists-db: ensureDefaultLists failed', error);
    throw error;
  }
}

export async function fetchLists(userId: string): Promise<List[]> {
  try {
    const defaultLists = await ensureDefaultLists(userId);
    const defaultIds = new Set(defaultLists.map((l) => l.id));

    const customRows = await db
      .select()
      .from(lists)
      .where(and(eq(lists.userId, userId), eq(lists.isDefault, 0)))
      .orderBy(desc(lists.createdAt));

    const customLists = customRows.filter((row) => !defaultIds.has(row.id)).map(rowToList);

    return [...defaultLists, ...customLists];
  } catch (error) {
    console.error('lists-db: fetchLists failed', error);
    throw error;
  }
}

export async function createList(name: string, userId: string, color?: string): Promise<string> {
  const sanitizedName = sanitizePlainText(name).slice(0, 100);
  if (!sanitizedName) {
    throw new Error('List name is required');
  }

  try {
    const id = crypto.randomUUID();
    const now = new Date();
    await db.insert(lists).values({
      id,
      userId,
      name: sanitizedName,
      color: color || 'blue',
      icon: 'dot',
      isDefault: 0,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  } catch (error) {
    console.error('lists-db: createList failed', error);
    throw error;
  }
}

export async function updateList(
  listId: string,
  userId: string,
  updates: { name?: string; color?: string }
): Promise<void> {
  try {
    const rows = await db.select().from(lists).where(eq(lists.id, listId)).limit(1);
    const row = rows[0];
    if (!row) throw new Error('List not found');
    if (row.userId !== userId) throw new Error('Unauthorized');
    if (row.isDefault === 1) throw new Error('Cannot edit default lists');

    const patch: Partial<typeof lists.$inferInsert> = { updatedAt: new Date() };

    if (updates.name !== undefined) {
      const sanitizedName = sanitizePlainText(updates.name).slice(0, 100);
      if (!sanitizedName) throw new Error('List name is required');
      patch.name = sanitizedName;
    }

    if (updates.color !== undefined) {
      patch.color = updates.color;
    }

    await db.update(lists).set(patch).where(eq(lists.id, listId));
  } catch (error) {
    console.error('lists-db: updateList failed', error);
    throw error;
  }
}

export async function deleteList(listId: string, userId: string): Promise<void> {
  try {
    const rows = await db.select().from(lists).where(eq(lists.id, listId)).limit(1);
    const row = rows[0];
    if (!row) throw new Error('List not found');
    if (row.userId !== userId) throw new Error('Unauthorized');
    if (row.isDefault === 1 || isDefaultListId(row.id)) {
      throw new Error('Cannot delete default lists');
    }

    // Remove listId from every article that references it.
    const ownedArticles = await db
      .select({ id: articles.id, listIds: articles.listIds })
      .from(articles)
      .where(eq(articles.userId, userId));

    const now = new Date();
    for (const article of ownedArticles) {
      const ids = parseJsonColumn<string[]>(article.listIds, []);
      if (!Array.isArray(ids) || !ids.includes(listId)) continue;
      const next = ids.filter((id) => id !== listId);
      await db
        .update(articles)
        .set({ listIds: serializeJsonColumn(next) as unknown as string[], updatedAt: now })
        .where(eq(articles.id, article.id));
    }

    await db.delete(lists).where(eq(lists.id, listId));
  } catch (error) {
    console.error('lists-db: deleteList failed', error);
    throw error;
  }
}

async function mutateArticleListIds(
  articleId: string,
  userId: string,
  mutator: (current: string[]) => string[]
): Promise<void> {
  const rows = await db
    .select({ userId: articles.userId, listIds: articles.listIds })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);
  const row = rows[0];
  if (!row) throw new Error('Article not found');
  if (row.userId !== userId) throw new Error('Unauthorized');

  const current = parseJsonColumn<string[]>(row.listIds, []);
  const next = mutator(Array.isArray(current) ? current : []);
  await db
    .update(articles)
    .set({ listIds: serializeJsonColumn(next) as unknown as string[], updatedAt: new Date() })
    .where(eq(articles.id, articleId));
}

export async function addArticleToList(
  articleId: string,
  listId: string,
  userId: string
): Promise<void> {
  try {
    const listRows = await db
      .select({ userId: lists.userId })
      .from(lists)
      .where(and(eq(lists.id, listId), eq(lists.userId, userId)))
      .limit(1);
    if (!listRows[0]) throw new Error('List not found');

    await mutateArticleListIds(articleId, userId, (current) =>
      current.includes(listId) ? current : [...current, listId]
    );
  } catch (error) {
    console.error('lists-db: addArticleToList failed', error);
    throw error;
  }
}

export async function removeArticleFromList(
  articleId: string,
  listId: string,
  userId: string
): Promise<void> {
  try {
    await mutateArticleListIds(articleId, userId, (current) =>
      current.filter((id) => id !== listId)
    );
  } catch (error) {
    console.error('lists-db: removeArticleFromList failed', error);
    throw error;
  }
}
