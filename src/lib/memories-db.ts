import crypto from 'crypto';
import { and, desc, eq } from 'drizzle-orm';

import type { SearchResult } from '../types';
import { normalizeTags, sanitizePlainText } from './articles-db';
import { db } from './db/client';
import { memories } from './db/schema';

// ---------------------------------------------------------------------------
// Memories: browser-memory captures persisted per user (see schema.memories).
// Mirrors the articles-db conventions: JSON columns stored as text, parsed on
// read and serialized on write; all reads/writes are scoped by userId.
// ---------------------------------------------------------------------------

export interface Memory {
  id: string;
  url: string;
  title: string;
  byline?: string;
  siteName?: string;
  /** Plain-text excerpt of the sanitized content (list/browse payload). */
  excerpt: string;
  tags: string[];
  capturedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

const EXCERPT_LENGTH = 280;

type MemoryRow = typeof memories.$inferSelect;

function parseJsonColumn<T>(raw: unknown, fallback: T): T {
  if (raw == null || raw === '') return fallback;
  if (typeof raw !== 'string') return raw as T;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error('memories-db: failed to parse json column', error);
    return fallback;
  }
}

function serializeJsonColumn(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.error('memories-db: failed to serialize json column', error);
    return null;
  }
}

function toIso(value: Date | number | null | undefined): string | undefined {
  if (value == null) return undefined;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function toExcerpt(content: string | null): string {
  const plain = sanitizePlainText(content ?? '').replace(/\s+/g, ' ');
  return plain.length > EXCERPT_LENGTH ? `${plain.slice(0, EXCERPT_LENGTH)}…` : plain;
}

function rowToMemory(row: MemoryRow): Memory {
  return {
    id: row.id,
    url: row.url,
    title: row.title || row.url,
    byline: row.byline ?? undefined,
    siteName: row.siteName ?? undefined,
    excerpt: toExcerpt(row.content),
    tags: normalizeTags(parseJsonColumn<string[]>(row.tags, [])),
    capturedAt: toIso(row.capturedAt),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

export async function listMemories(userId: string): Promise<Memory[]> {
  try {
    const rows = await db
      .select()
      .from(memories)
      .where(eq(memories.userId, userId))
      .orderBy(desc(memories.createdAt));
    return rows.map(rowToMemory);
  } catch (error) {
    console.error('memories-db: listMemories failed', error);
    throw error;
  }
}

export async function findMemoryByUrl(url: string, userId: string): Promise<string | null> {
  try {
    const rows = await db
      .select({ id: memories.id })
      .from(memories)
      .where(and(eq(memories.userId, userId), eq(memories.url, url)))
      .limit(1);
    return rows[0]?.id ?? null;
  } catch (error) {
    console.error('memories-db: findMemoryByUrl failed', error);
    throw error;
  }
}

/**
 * Insert an already-sanitized memory snapshot. Callers are expected to run the
 * payload through sanitizeBrowserMemorySnapshot (browser-memory-import.ts)
 * first. Returns the new id, or the existing id when the (userId, url) unique
 * index reports a concurrent duplicate — imports stay idempotent under races.
 */
export async function createMemoryRecord(payload: {
  userId: string;
  url: string;
  title: string;
  byline?: string;
  siteName?: string;
  content: string;
  tags?: string[];
  capturedAt?: Date;
}): Promise<string> {
  const now = new Date();
  const id = crypto.randomUUID();
  try {
    await db.insert(memories).values({
      id,
      userId: payload.userId,
      url: payload.url,
      title: payload.title,
      byline: payload.byline || null,
      siteName: payload.siteName || null,
      content: payload.content,
      tags: serializeJsonColumn(normalizeTags(payload.tags ?? [])) as unknown as string[],
      capturedAt: payload.capturedAt ?? null,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  } catch (error) {
    // Unique (user_id, url) race: another request imported the same URL first.
    if (error instanceof Error && /unique/i.test(error.message)) {
      const existingId = await findMemoryByUrl(payload.url, payload.userId);
      if (existingId) return existingId;
    }
    console.error('memories-db: createMemoryRecord failed', error);
    throw error;
  }
}

/** Update memory tags and/or title. Returns false when not found / not owned. */
export async function updateMemory(
  id: string,
  userId: string,
  payload: { tags?: unknown; title?: unknown }
): Promise<boolean> {
  const updates: Partial<typeof memories.$inferInsert> = { updatedAt: new Date() };

  if (payload.tags !== undefined) {
    updates.tags = serializeJsonColumn(normalizeTags(payload.tags)) as unknown as string[];
  }
  if (typeof payload.title === 'string') {
    const title = sanitizePlainText(payload.title).slice(0, 500);
    if (title.length > 0) updates.title = title;
  }

  try {
    const owned = await db
      .select({ id: memories.id })
      .from(memories)
      .where(and(eq(memories.id, id), eq(memories.userId, userId)))
      .limit(1);
    if (!owned[0]) return false;

    await db
      .update(memories)
      .set(updates)
      .where(and(eq(memories.id, id), eq(memories.userId, userId)));
    return true;
  } catch (error) {
    console.error('memories-db: updateMemory failed', error);
    throw error;
  }
}

/** Delete a memory. Returns false when not found / not owned. */
export async function deleteMemory(id: string, userId: string): Promise<boolean> {
  try {
    const owned = await db
      .select({ id: memories.id })
      .from(memories)
      .where(and(eq(memories.id, id), eq(memories.userId, userId)))
      .limit(1);
    if (!owned[0]) return false;

    await db.delete(memories).where(and(eq(memories.id, id), eq(memories.userId, userId)));
    return true;
  } catch (error) {
    console.error('memories-db: deleteMemory failed', error);
    throw error;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightSearchTerms(text: string, query: string): string {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  let result = text;
  terms.forEach((term) => {
    result = result.replace(new RegExp(`(${escapeRegExp(term)})`, 'gi'), '**$1**');
  });
  return result;
}

function getSnippet(text: string, query: string, maxLength = 150): string {
  const lowerText = text.toLowerCase();
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);

  let bestIndex = -1;
  for (const term of terms) {
    const index = lowerText.indexOf(term);
    if (index !== -1) {
      bestIndex = index;
      break;
    }
  }

  if (bestIndex === -1) {
    return text.slice(0, maxLength) + (text.length > maxLength ? '...' : '');
  }

  const start = Math.max(0, bestIndex - 50);
  const end = Math.min(text.length, bestIndex + maxLength - 50);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = `...${snippet}`;
  if (end < text.length) snippet = `${snippet}...`;
  return highlightSearchTerms(snippet, query);
}

function buildMemoryMatchFields(
  terms: string[],
  title: string,
  plainContent: string,
  tagsText: string,
  sanitizedQuery: string
): {
  matchedFields: string[];
  snippets: { field: string; text: string }[];
  relevanceScore: number;
} {
  const matchedFields: string[] = [];
  const snippets: { field: string; text: string }[] = [];
  let relevanceScore = 0;

  const lowerTitle = title.toLowerCase();
  const lowerContent = plainContent.toLowerCase();

  if (terms.some((term) => lowerTitle.includes(term))) {
    matchedFields.push('title');
    snippets.push({ field: 'title', text: highlightSearchTerms(title, sanitizedQuery) });
    relevanceScore += 10;
  }
  if (terms.some((term) => lowerContent.includes(term))) {
    matchedFields.push('content');
    snippets.push({ field: 'content', text: getSnippet(plainContent, sanitizedQuery) });
    relevanceScore += 5;
  }
  if (terms.some((term) => tagsText.includes(term))) {
    matchedFields.push('tags');
    relevanceScore += 3;
  }

  return { matchedFields, snippets, relevanceScore };
}

// Follow-up: upgrade to SQL LIKE or FTS5 once dataset grows; current impl is
// in-memory to match searchArticles (articles-db.ts).
export async function searchMemories(userId: string, query: string): Promise<SearchResult[]> {
  const sanitizedQuery = sanitizePlainText(query);
  if (!sanitizedQuery || sanitizedQuery.length < 2) return [];

  const terms = sanitizedQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  if (terms.length === 0) return [];

  try {
    const rows = await db.select().from(memories).where(eq(memories.userId, userId));

    const results: SearchResult[] = [];
    for (const row of rows) {
      const title = row.title || row.url || '';
      const plainContent = sanitizePlainText(row.content ?? '');
      const tags = normalizeTags(parseJsonColumn<string[]>(row.tags, []));

      const lowerTitle = title.toLowerCase();
      const lowerContent = plainContent.toLowerCase();
      const tagsText = tags.join(' ').toLowerCase();

      const matchesAll = terms.every(
        (term) =>
          lowerTitle.includes(term) || lowerContent.includes(term) || tagsText.includes(term)
      );
      if (!matchesAll) continue;

      const { matchedFields, snippets, relevanceScore } = buildMemoryMatchFields(
        terms,
        title,
        plainContent,
        tagsText,
        sanitizedQuery
      );

      results.push({
        id: row.id,
        url: row.url,
        title,
        byline: row.byline ?? undefined,
        notesCount: 0,
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
        matchedFields,
        snippets,
        relevanceScore,
        kind: 'memory',
      });
    }

    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return results;
  } catch (error) {
    console.error('memories-db: searchMemories failed', error);
    throw error;
  }
}
