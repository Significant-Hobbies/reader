import crypto from 'node:crypto';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import type { RssEntry, RssFeed } from '../types';
import { sanitizePlainText, sanitizeTitle } from './articles-db';
import { db } from './db/client';
import { rssEntries, rssFeeds } from './db/schema';
import type { NormalizedFeedEntry } from './rss-parser';

let rssSchemaPromise: Promise<void> | null = null;

const RSS_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS rss_feeds (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    feed_url text NOT NULL,
    title text NOT NULL,
    site_url text,
    last_fetched_at integer,
    last_error text,
    etag text,
    last_modified text,
    created_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
    updated_at integer DEFAULT (unixepoch() * 1000) NOT NULL
  )`,
  'CREATE UNIQUE INDEX IF NOT EXISTS rss_feeds_user_feed_unique ON rss_feeds (user_id, feed_url)',
  'CREATE INDEX IF NOT EXISTS rss_feeds_user_created_idx ON rss_feeds (user_id, created_at)',
  `CREATE TABLE IF NOT EXISTS rss_entries (
    id text PRIMARY KEY NOT NULL,
    feed_id text NOT NULL REFERENCES rss_feeds(id) ON DELETE CASCADE,
    external_id text NOT NULL,
    url text,
    title text NOT NULL,
    author text,
    content text,
    excerpt text,
    published_at integer,
    read_at integer,
    saved_article_id text REFERENCES articles(id) ON DELETE SET NULL,
    created_at integer DEFAULT (unixepoch() * 1000) NOT NULL,
    updated_at integer DEFAULT (unixepoch() * 1000) NOT NULL
  )`,
  'CREATE UNIQUE INDEX IF NOT EXISTS rss_entries_feed_external_unique ON rss_entries (feed_id, external_id)',
  'CREATE INDEX IF NOT EXISTS rss_entries_feed_published_idx ON rss_entries (feed_id, published_at)',
  'CREATE INDEX IF NOT EXISTS rss_entries_feed_read_idx ON rss_entries (feed_id, read_at)',
] as const;

/**
 * Ensures additive RSS tables exist using the Worker's existing Turso binding.
 * The SQL migration remains canonical; this idempotent guard handles deploy
 * environments where database credentials are intentionally unavailable to CI.
 */
export async function ensureRssSchema(): Promise<void> {
  if (!rssSchemaPromise) {
    rssSchemaPromise = (async () => {
      for (const statement of RSS_SCHEMA_STATEMENTS) {
        await db.run(sql.raw(statement));
      }
    })().catch((error) => {
      rssSchemaPromise = null;
      throw error;
    });
  }
  return rssSchemaPromise;
}

function toIso(value: Date | number | null | undefined): string | undefined {
  if (value == null) return undefined;
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function normalizeUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export async function listRssFeeds(userId: string): Promise<RssFeed[]> {
  const rows = await db
    .select({
      id: rssFeeds.id,
      feedUrl: rssFeeds.feedUrl,
      title: rssFeeds.title,
      siteUrl: rssFeeds.siteUrl,
      lastFetchedAt: rssFeeds.lastFetchedAt,
      lastError: rssFeeds.lastError,
      createdAt: rssFeeds.createdAt,
      totalCount: sql<number>`count(${rssEntries.id})`,
      unreadCount: sql<number>`sum(case when ${rssEntries.id} is not null and ${rssEntries.readAt} is null then 1 else 0 end)`,
    })
    .from(rssFeeds)
    .leftJoin(rssEntries, eq(rssEntries.feedId, rssFeeds.id))
    .where(eq(rssFeeds.userId, userId))
    .groupBy(rssFeeds.id)
    .orderBy(rssFeeds.title);

  return rows.map((row) => ({
    id: row.id,
    feedUrl: row.feedUrl,
    title: row.title,
    siteUrl: row.siteUrl ?? undefined,
    lastFetchedAt: toIso(row.lastFetchedAt),
    lastError: row.lastError ?? undefined,
    createdAt: toIso(row.createdAt) ?? new Date(0).toISOString(),
    totalCount: Number(row.totalCount ?? 0),
    unreadCount: Number(row.unreadCount ?? 0),
  }));
}

export async function findRssFeedByUrl(userId: string, feedUrl: string) {
  const rows = await db
    .select()
    .from(rssFeeds)
    .where(and(eq(rssFeeds.userId, userId), eq(rssFeeds.feedUrl, feedUrl)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getOwnedRssFeed(userId: string, feedId: string) {
  const rows = await db
    .select()
    .from(rssFeeds)
    .where(and(eq(rssFeeds.userId, userId), eq(rssFeeds.id, feedId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function addRssFeed(payload: {
  userId: string;
  feedUrl: string;
  title?: string;
  siteUrl?: string;
}): Promise<{ id: string; existing: boolean }> {
  const feedUrl = new URL(payload.feedUrl).href;
  const existing = await findRssFeedByUrl(payload.userId, feedUrl);
  if (existing) return { id: existing.id, existing: true };

  const id = crypto.randomUUID();
  const now = new Date();
  try {
    await db.insert(rssFeeds).values({
      id,
      userId: payload.userId,
      feedUrl,
      title: sanitizeTitle(payload.title, new URL(feedUrl).hostname),
      siteUrl: normalizeUrl(payload.siteUrl),
      createdAt: now,
      updatedAt: now,
    });
    return { id, existing: false };
  } catch (error) {
    if (error instanceof Error && /unique/i.test(error.message)) {
      const raced = await findRssFeedByUrl(payload.userId, feedUrl);
      if (raced) return { id: raced.id, existing: true };
    }
    throw error;
  }
}

export async function deleteRssFeed(userId: string, feedId: string): Promise<boolean> {
  const owned = await getOwnedRssFeed(userId, feedId);
  if (!owned) return false;
  await db.delete(rssFeeds).where(and(eq(rssFeeds.id, feedId), eq(rssFeeds.userId, userId)));
  return true;
}

export async function listRssEntries(
  userId: string,
  options: { feedId?: string; unreadOnly?: boolean } = {}
): Promise<RssEntry[]> {
  const conditions = [eq(rssFeeds.userId, userId)];
  if (options.feedId) conditions.push(eq(rssEntries.feedId, options.feedId));
  if (options.unreadOnly) conditions.push(isNull(rssEntries.readAt));

  const rows = await db
    .select({
      id: rssEntries.id,
      feedId: rssEntries.feedId,
      feedTitle: rssFeeds.title,
      url: rssEntries.url,
      title: rssEntries.title,
      author: rssEntries.author,
      excerpt: rssEntries.excerpt,
      publishedAt: rssEntries.publishedAt,
      readAt: rssEntries.readAt,
      savedArticleId: rssEntries.savedArticleId,
    })
    .from(rssEntries)
    .innerJoin(rssFeeds, eq(rssEntries.feedId, rssFeeds.id))
    .where(and(...conditions))
    .orderBy(desc(sql`coalesce(${rssEntries.publishedAt}, ${rssEntries.createdAt})`));

  return rows.map((row) => ({
    id: row.id,
    feedId: row.feedId,
    feedTitle: row.feedTitle,
    url: row.url ?? undefined,
    title: row.title,
    author: row.author ?? undefined,
    excerpt: row.excerpt ?? undefined,
    publishedAt: toIso(row.publishedAt),
    readAt: toIso(row.readAt),
    savedArticleId: row.savedArticleId ?? undefined,
  }));
}

export async function upsertRssEntries(
  feedId: string,
  entries: NormalizedFeedEntry[]
): Promise<number> {
  let inserted = 0;
  const now = new Date();
  for (const entry of entries) {
    const rows = await db
      .insert(rssEntries)
      .values({
        id: crypto.randomUUID(),
        feedId,
        externalId: sanitizePlainText(entry.externalId).slice(0, 1_000),
        url: normalizeUrl(entry.url),
        title: sanitizeTitle(entry.title, 'Untitled entry'),
        author: entry.author ? sanitizePlainText(entry.author).slice(0, 500) : null,
        content: entry.content ?? null,
        excerpt: entry.excerpt ? sanitizePlainText(entry.excerpt).slice(0, 500) : null,
        publishedAt: entry.publishedAt ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: [rssEntries.feedId, rssEntries.externalId] })
      .returning({ id: rssEntries.id });
    if (rows.length > 0) inserted += 1;
  }
  return inserted;
}

export async function updateRssFeedAfterRefresh(
  feedId: string,
  payload: {
    title?: string;
    siteUrl?: string;
    etag?: string | null;
    lastModified?: string | null;
    error?: string | null;
  }
) {
  await db
    .update(rssFeeds)
    .set({
      ...(payload.title ? { title: sanitizeTitle(payload.title) } : {}),
      ...(payload.siteUrl ? { siteUrl: normalizeUrl(payload.siteUrl) } : {}),
      ...(payload.etag !== undefined ? { etag: payload.etag } : {}),
      ...(payload.lastModified !== undefined ? { lastModified: payload.lastModified } : {}),
      lastFetchedAt: new Date(),
      lastError: payload.error ? sanitizePlainText(payload.error).slice(0, 500) : null,
      updatedAt: new Date(),
    })
    .where(eq(rssFeeds.id, feedId));
}

export async function setRssEntryReadState(
  userId: string,
  entryId: string,
  read: boolean
): Promise<boolean> {
  const entry = await getOwnedRssEntry(userId, entryId);
  if (!entry) return false;
  await db
    .update(rssEntries)
    .set({ readAt: read ? new Date() : null, updatedAt: new Date() })
    .where(eq(rssEntries.id, entryId));
  return true;
}

export async function getOwnedRssEntry(userId: string, entryId: string) {
  const rows = await db
    .select({ entry: rssEntries, feedTitle: rssFeeds.title })
    .from(rssEntries)
    .innerJoin(rssFeeds, eq(rssEntries.feedId, rssFeeds.id))
    .where(and(eq(rssEntries.id, entryId), eq(rssFeeds.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function linkRssEntryToArticle(entryId: string, articleId: string) {
  await db
    .update(rssEntries)
    .set({ savedArticleId: articleId, updatedAt: new Date() })
    .where(eq(rssEntries.id, entryId));
}
