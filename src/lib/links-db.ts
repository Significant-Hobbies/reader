import { createHash } from 'node:crypto';
import { and, desc, eq, like, or, sql } from 'drizzle-orm';
import sanitizeHtml from 'sanitize-html';

import { db } from './db/client';
import { articles } from './db/schema';

type LinkStatus = 'unread' | 'read';
export type SavedLink = {
  id: string;
  url: string;
  title: string;
  status: LinkStatus;
  createdAt: string;
};
export type LinkQuery = { query?: string; status?: LinkStatus; limit?: number; offset?: number };

const columns = {
  id: articles.id,
  url: articles.url,
  title: articles.title,
  status: articles.status,
  createdAt: articles.createdAt,
};

export function normalizeLinkUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 4096) throw new Error('Enter a valid URL.');
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Use an HTTP or HTTPS URL without credentials.');
  }
  url.hash = '';
  return url.href;
}

function savedLink(
  row:
    | typeof articles.$inferSelect
    | {
        id: string;
        url: string;
        title: string;
        status: string | null;
        createdAt: Date;
      }
): SavedLink {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    status: row.status === 'read' ? 'read' : 'unread',
    createdAt: row.createdAt.toISOString(),
  };
}

const linkCount = sql<number>`count(*)`;

export async function listLinks(userId: string, options: LinkQuery = {}) {
  const conditions = [eq(articles.userId, userId)];
  // Preserve legacy articles as links; uploaded blobs are not web links.
  conditions.push(or(like(articles.url, 'https://%'), like(articles.url, 'http://%'))!);
  if (options.status) {
    conditions.push(
      options.status === 'read'
        ? eq(articles.status, 'read')
        : sql`coalesce(${articles.status}, 'in_progress') != 'read'`
    );
  }
  if (options.query?.trim()) {
    const query = options.query.trim().slice(0, 500);
    conditions.push(
      sql`(instr(lower(${articles.title}), lower(${query})) > 0 or instr(lower(${articles.url}), lower(${query})) > 0)`
    );
  }
  const where = and(...conditions);
  const limit = Math.min(50, Math.max(1, options.limit ?? 20));
  const offset = Math.max(0, options.offset ?? 0);
  const [rows, count] = await Promise.all([
    db
      .select(columns)
      .from(articles)
      .where(where)
      .orderBy(desc(articles.createdAt), desc(articles.id))
      .limit(limit)
      .offset(offset),
    db.select({ total: linkCount }).from(articles).where(where),
  ]);
  const total = Number(count[0]?.total ?? 0);
  const hasMore = offset + rows.length < total;
  return {
    items: rows.map(savedLink),
    total,
    nextOffset: hasMore ? offset + rows.length : null,
  };
}

export async function addLink(userId: string, input: { url: unknown; title?: unknown }) {
  const url = normalizeLinkUrl(input.url);
  const [existing] = await db
    .select({ id: articles.id })
    .from(articles)
    .where(and(eq(articles.userId, userId), eq(articles.url, url)))
    .limit(1);
  if (existing) return { id: existing.id, existing: true };
  const title =
    typeof input.title === 'string'
      ? sanitizeHtml(input.title, { allowedTags: [], allowedAttributes: {} }).trim().slice(0, 500)
      : '';
  // Stable, per-account IDs deduplicate concurrent saves without a schema migration.
  const id = createHash('sha256')
    .update(JSON.stringify([userId, url]))
    .digest('hex');
  const rows = await db
    .insert(articles)
    .values({
      id,
      userId,
      url,
      title: title || new URL(url).hostname,
      type: 'link',
      status: 'in_progress',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing({ target: articles.id })
    .returning({ id: articles.id });
  return { id, existing: rows.length === 0 };
}

export async function getLink(userId: string, id: string) {
  const [row] = await db
    .select({ ...columns, content: articles.content, extractedText: articles.extractedText })
    .from(articles)
    .where(and(eq(articles.userId, userId), eq(articles.id, id)))
    .limit(1);
  if (!row || !/^https?:\/\//u.test(row.url)) return null;
  return { ...savedLink(row), storedContent: row.content || row.extractedText || '' };
}

export async function setLinkRead(userId: string, id: string, read: boolean) {
  const rows = await db
    .update(articles)
    .set({
      status: read ? 'read' : 'in_progress',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(articles.userId, userId),
        eq(articles.id, id),
        or(like(articles.url, 'https://%'), like(articles.url, 'http://%'))
      )
    )
    .returning(columns);
  return rows[0] ? savedLink(rows[0]) : null;
}
