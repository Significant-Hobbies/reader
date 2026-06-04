import crypto from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import type { IOptions } from 'sanitize-html';
import sanitizeHtml from 'sanitize-html';

import type {
  AIChatMessage,
  Article,
  ArticleStatus,
  ArticleSummary,
  Note,
  SessionReview,
} from '../types';
import { db } from './db/client';
import { articles } from './db/schema';
import { getPdfDownloadUrl } from './storage';

// ---------------------------------------------------------------------------
// Sanitize / normalize utilities (previously in articles-service.ts)
// ---------------------------------------------------------------------------

const baseAllowedAttributes = sanitizeHtml.defaults.allowedAttributes ?? {};
const plainTextSanitizeOptions: IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  allowedSchemes: [],
  allowedSchemesByTag: {},
  disallowedTagsMode: 'discard',
  enforceHtmlBoundary: false,
};

const htmlSanitizeOptions: IOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    'img',
    'picture',
    'source',
    'video',
    'iframe',
  ],
  allowedAttributes: {
    ...baseAllowedAttributes,
    '*': ['class', 'id', 'lang', 'dir'],
    a: [...(baseAllowedAttributes.a ?? []), 'rel'],
    img: [...(baseAllowedAttributes.img ?? []), 'sizes'],
    iframe: ['src', 'title', 'width', 'height', 'allow', 'allowfullscreen', 'loading'],
  },
  allowedSchemes: sanitizeHtml.defaults.allowedSchemes,
  allowedSchemesByTag: {
    ...(sanitizeHtml.defaults.allowedSchemesByTag ?? {}),
    img: ['http', 'https', 'data'],
    iframe: ['http', 'https'],
  },
  allowedIframeHostnames: ['www.youtube.com', 'player.vimeo.com'],
};

type NoteInput = {
  id: string | number;
  text?: unknown;
  anchor?: unknown;
};

type NoteAnchorInput = {
  elementIndex?: unknown;
  tagName?: unknown;
  textPreview?: unknown;
};

type AIChatMessageInput = {
  role?: unknown;
  content?: unknown;
};

const MAX_AI_CHAT_MESSAGES = 80;
const MAX_AI_CHAT_MESSAGE_LENGTH = 4000;

const isNoteInput = (value: unknown): value is NoteInput => {
  if (typeof value !== 'object' || value === null) return false;
  const id = (value as { id?: unknown }).id;
  return typeof id === 'string' || typeof id === 'number';
};

const isNoteAnchorInput = (value: unknown): value is NoteAnchorInput =>
  typeof value === 'object' && value !== null;

const isAIChatMessageInput = (value: unknown): value is AIChatMessageInput =>
  typeof value === 'object' && value !== null;

export const sanitizePlainText = (value: unknown) =>
  sanitizeHtml(String(value ?? ''), plainTextSanitizeOptions).trim();

const sanitizeHTML = (value: unknown) => sanitizeHtml(String(value ?? ''), htmlSanitizeOptions);

export const sanitizeTitle = (value: unknown, fallback = '') =>
  sanitizePlainText(value ?? fallback).slice(0, 500);

const normalizeAnchor = (anchor: NoteAnchorInput) => {
  const index = Number(anchor.elementIndex);
  if (!Number.isFinite(index)) return null;

  return {
    elementIndex: Math.max(0, Math.round(index)),
    tagName: anchor.tagName
      ? sanitizePlainText(anchor.tagName).toLowerCase().slice(0, 40)
      : undefined,
    textPreview: anchor.textPreview
      ? sanitizePlainText(anchor.textPreview).slice(0, 240)
      : undefined,
  };
};

export function normalizeTags(payload: unknown): string[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((tag) => {
      if (typeof tag !== 'string') return null;
      const sanitized = sanitizePlainText(tag).toLowerCase();
      if (!sanitized || sanitized.length > 50) return null;
      return sanitized;
    })
    .filter((tag): tag is string => Boolean(tag))
    .filter((tag, index, array) => array.indexOf(tag) === index) // Remove duplicates
    .slice(0, 20); // Max 20 tags per article
}

/** Calculate reading time in minutes from HTML content (225 wpm). */
export function calculateReadingTime(htmlContent: string): number {
  const plainText = sanitizePlainText(htmlContent);
  const words = plainText.split(/\s+/).filter((word) => word.length > 0);
  const WORDS_PER_MINUTE = 225;
  return Math.max(1, Math.round(words.length / WORDS_PER_MINUTE));
}

/** Format reading time for display. */
export function formatReadingTime(minutes?: number): string {
  if (!minutes || minutes < 1) return '< 1 min read';
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes === 0 ? `${hours} hr read` : `${hours} hr ${remainingMinutes} min read`;
  }
  return `${minutes} min read`;
}

export function normalizeNotes(payload: unknown): Note[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((note) => {
      if (!isNoteInput(note)) return null;
      const normalizedNote: Note = {
        id: Number(note.id) || Date.now(),
        text: sanitizePlainText(note.text),
      };
      if (isNoteAnchorInput(note.anchor)) {
        const normalizedAnchor = normalizeAnchor(note.anchor);
        if (normalizedAnchor) normalizedNote.anchor = normalizedAnchor;
      }
      return normalizedNote;
    })
    .filter(Boolean) as Note[];
}

export function normalizeAIChatMessages(payload: unknown): AIChatMessage[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((message) => {
      if (!isAIChatMessageInput(message)) return null;
      if (message.role !== 'user' && message.role !== 'assistant') return null;
      const content = sanitizePlainText(message.content).slice(0, MAX_AI_CHAT_MESSAGE_LENGTH);
      if (!content) return null;
      return { role: message.role, content } as AIChatMessage;
    })
    .filter((message): message is AIChatMessage => Boolean(message))
    .slice(-MAX_AI_CHAT_MESSAGES);
}

export function sanitizeArticlePayload(payload: {
  url: string;
  title?: string;
  byline?: string;
  content?: string;
  projectId?: string;
  tags?: string[];
  userId: string;
  type?: 'article' | 'pdf' | 'link';
  pdfUrl?: string;
  extractedText?: string;
  pdfMetadata?: { pageCount?: number; fileSize?: number; storagePath?: string };
  listIds?: string[];
  category?: string;
}) {
  const sanitizedUrl = sanitizePlainText(payload.url);
  if (!sanitizedUrl) throw new Error('URL is required');

  const defProjectId = `${payload.userId}_default`;
  const category = payload.category
    ? sanitizePlainText(payload.category.trim()).slice(0, 50)
    : undefined;
  const listIds = Array.isArray(payload.listIds)
    ? payload.listIds.filter((id) => typeof id === 'string' && id.trim().length > 0)
    : [];

  const base = {
    url: sanitizedUrl,
    title: sanitizeTitle(payload.title, sanitizedUrl),
    byline: sanitizePlainText(payload.byline || ''),
    content: sanitizeHTML(payload.content || ''),
    projectId: sanitizePlainText(payload.projectId || defProjectId) || defProjectId,
    tags: normalizeTags(payload.tags),
    userId: payload.userId,
    type: payload.type || 'article',
    listIds,
    category,
  };

  if (payload.type === 'pdf') {
    return {
      ...base,
      pdfUrl: payload.pdfUrl,
      extractedText: payload.extractedText,
      pdfMetadata: payload.pdfMetadata,
    };
  }
  return base;
}

// JSON columns are declared as text() in Drizzle schema with $type<T>() for TS
// hinting only — the runtime value is the raw string libsql returns. We parse
// on read, serialize on write.
function parseJsonColumn<T>(raw: unknown, fallback: T): T {
  if (raw == null || raw === '') return fallback;
  if (typeof raw !== 'string') {
    // Drizzle may, in some future version, decode this automatically.
    return raw as T;
  }
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error('articles-db: failed to parse json column', error);
    return fallback;
  }
}

function serializeJsonColumn(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.error('articles-db: failed to serialize json column', error);
    return null;
  }
}

function toIso(value: Date | number | null | undefined): string | undefined {
  if (value == null) return undefined;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function normalizeStatus(status: unknown): ArticleStatus {
  return status === 'read' ? 'read' : 'in_progress';
}

function defaultProjectId(userId: string) {
  return `${userId}_default`;
}

type ArticleRow = typeof articles.$inferSelect;

type PdfMetadata = { pageCount?: number; fileSize?: number; storagePath?: string };

function normalizeArticleType(value: unknown): 'article' | 'pdf' | 'link' {
  return value === 'pdf' || value === 'link' ? value : 'article';
}

function rowToArticle(row: ArticleRow): Article {
  const tags = parseJsonColumn<string[]>(row.tags, []);
  const listIds = parseJsonColumn<string[]>(row.listIds, []);
  const notes = parseJsonColumn<Note[]>(row.notes, []);
  const aiChat = normalizeAIChatMessages(parseJsonColumn<AIChatMessage[]>(row.aiChat, []));
  const summary = parseJsonColumn<Record<string, string> | string | null>(row.summary, null);
  const keyPoints = parseJsonColumn<string[] | null>(row.keyPoints, null);
  const pdfMetadata = parseJsonColumn<PdfMetadata | null>(row.pdfMetadata, null);
  const sessionReview = parseJsonColumn<SessionReview | null>(row.sessionReview, null);

  const aiSummary =
    typeof summary === 'string'
      ? summary
      : summary && typeof summary.medium === 'string'
        ? summary.medium
        : undefined;

  const type = normalizeArticleType(row.type);

  return {
    id: row.id,
    url: row.url,
    title: row.title || row.url,
    byline: row.byline ?? undefined,
    content: row.content ?? '',
    notes,
    aiChat,
    aiSummary,
    keyPoints: Array.isArray(keyPoints) ? keyPoints : undefined,
    projectId: defaultProjectId(row.userId),
    status: normalizeStatus(row.status),
    tags: normalizeTags(tags),
    readingTimeMinutes:
      typeof row.readingTimeMinutes === 'number' ? row.readingTimeMinutes : undefined,
    type,
    // For PDFs, synthesize a same-origin proxy URL. The client calls this and
    // the route verifies auth + ownership before streaming bytes from Blob.
    pdfUrl: type === 'pdf' && row.pdfStorageKey ? getPdfDownloadUrl(row.id) : undefined,
    extractedText: row.extractedText ?? undefined,
    pdfMetadata: pdfMetadata ?? undefined,
    category: row.category ?? undefined,
    sessionReview: sessionReview ?? undefined,
    notesCount: Array.isArray(notes) ? notes.length : 0,
    listIds: Array.isArray(listIds) ? listIds : [],
    userId: row.userId,
    ...(row.shareId ? { shareId: row.shareId } : {}),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

function rowToSummary(row: ArticleRow): ArticleSummary {
  const notes = parseJsonColumn<Note[]>(row.notes, []);
  const tags = normalizeTags(parseJsonColumn<string[]>(row.tags, []));
  const listIds = parseJsonColumn<string[]>(row.listIds, []);
  const pdfMetadata = parseJsonColumn<PdfMetadata | null>(row.pdfMetadata, null);
  const type = normalizeArticleType(row.type);

  return {
    id: row.id,
    url: row.url,
    title: row.title || row.url,
    byline: row.byline ?? undefined,
    projectId: defaultProjectId(row.userId),
    status: normalizeStatus(row.status),
    tags,
    readingTimeMinutes:
      typeof row.readingTimeMinutes === 'number' ? row.readingTimeMinutes : undefined,
    type,
    pdfUrl: type === 'pdf' && row.pdfStorageKey ? getPdfDownloadUrl(row.id) : undefined,
    pdfMetadata: pdfMetadata ?? undefined,
    category: row.category ?? undefined,
    notesCount: notes.length,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    listIds: Array.isArray(listIds) ? listIds : [],
  };
}

export async function fetchArticleSummaries(
  userId: string,
  projectId?: string,
  listId?: string
): Promise<ArticleSummary[]> {
  // projectId retained for signature parity; the Turso schema drops the column.
  void projectId;
  try {
    const rows = await db
      .select()
      .from(articles)
      .where(eq(articles.userId, userId))
      .orderBy(desc(articles.createdAt));

    const filtered =
      listId && listId !== 'all'
        ? rows.filter((row) => {
            const ids = parseJsonColumn<string[]>(row.listIds, []);
            return Array.isArray(ids) && ids.includes(listId);
          })
        : rows;

    return filtered.map(rowToSummary);
  } catch (error) {
    console.error('articles-db: fetchArticleSummaries failed', error);
    throw error;
  }
}

export async function fetchArticlesForSourceMap(userId: string): Promise<Article[]> {
  try {
    const rows = await db
      .select()
      .from(articles)
      .where(eq(articles.userId, userId))
      .orderBy(desc(articles.updatedAt))
      .limit(50);

    return rows.map(rowToArticle);
  } catch (error) {
    console.error('articles-db: fetchArticlesForSourceMap failed', error);
    throw error;
  }
}

// Worker-edge cache for article reads. Keyed by article id AND user id —
// articles are per-user, and the ownership check (row.userId !== userId)
// otherwise leaks across users if we cache the row alone. 5-minute TTL;
// updateArticle / deleteArticle bust the entry below.
const ARTICLE_CACHE_TTL_SECONDS = 5 * 60;
const articleCacheUrl = (id: string, userId: string) =>
  `https://internal-cache/article/${encodeURIComponent(id)}/${encodeURIComponent(userId)}:v1`;

function getEdgeCache(): Cache | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).caches?.default as Cache | undefined;
}

export async function fetchArticleById(id: string, userId: string): Promise<Article | null> {
  const edgeCache = getEdgeCache();
  const cacheUrl = articleCacheUrl(id, userId);

  if (edgeCache) {
    try {
      const cached = await edgeCache.match(cacheUrl);
      if (cached) {
        return (await cached.json()) as Article;
      }
    } catch {
      // Fall through to DB on cache read failure.
    }
  }

  let article: Article | null;
  try {
    const rows = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
    const row = rows[0];
    if (!row) return null;
    if (row.userId !== userId) return null;
    article = rowToArticle(row);
  } catch (error) {
    console.error('articles-db: fetchArticleById failed', error);
    throw error;
  }

  if (edgeCache && article) {
    try {
      const response = new Response(JSON.stringify(article), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${ARTICLE_CACHE_TTL_SECONDS}, s-maxage=${ARTICLE_CACHE_TTL_SECONDS}`,
        },
      });
      void edgeCache.put(cacheUrl, response);
    } catch {
      // Non-fatal: serving fresh data without storing the cache entry.
    }
  }

  return article;
}

async function invalidateArticleCache(id: string, userId: string): Promise<void> {
  const edgeCache = getEdgeCache();
  if (!edgeCache) return;
  try {
    await edgeCache.delete(articleCacheUrl(id, userId));
  } catch {
    // Non-fatal — stale entry will expire at the 5-min TTL anyway.
  }
}

export async function findArticleByUrl(url: string, userId: string): Promise<string | null> {
  try {
    const rows = await db
      .select({ id: articles.id })
      .from(articles)
      .where(and(eq(articles.userId, userId), eq(articles.url, url)))
      .limit(1);
    return rows[0]?.id ?? null;
  } catch (error) {
    console.error('articles-db: findArticleByUrl failed', error);
    throw error;
  }
}

export async function createArticleRecord(payload: {
  url: string;
  title?: string;
  byline?: string;
  content?: string;
  projectId?: string;
  tags?: string[];
  userId: string;
  type?: 'article' | 'pdf' | 'link';
  pdfUrl?: string;
  extractedText?: string;
  pdfMetadata?: {
    pageCount?: number;
    fileSize?: number;
    storagePath?: string;
  };
  listIds?: string[];
  category?: string;
}): Promise<string> {
  try {
    const sanitized = sanitizeArticlePayload(payload);
    const readingTimeMinutes = calculateReadingTime(sanitized.content);
    const now = new Date();
    const id = crypto.randomUUID();

    const isPdf = sanitized.type === 'pdf';
    const pdfMetadata = isPdf ? (payload.pdfMetadata ?? null) : null;

    await db.insert(articles).values({
      id,
      userId: sanitized.userId,
      url: sanitized.url,
      title: sanitized.title,
      byline: sanitized.byline || null,
      content: sanitized.content,
      tags: serializeJsonColumn(sanitized.tags) as unknown as string[],
      listIds: serializeJsonColumn(sanitized.listIds) as unknown as string[],
      notes: serializeJsonColumn([]) as unknown as Note[],
      aiChat: serializeJsonColumn([]) as unknown as AIChatMessage[],
      summary: null,
      keyPoints: null,
      status: 'in_progress',
      readingTimeMinutes,
      type: sanitized.type,
      pdfStorageKey: isPdf ? (payload.pdfMetadata?.storagePath ?? null) : null,
      extractedText: isPdf ? (payload.extractedText ?? null) : null,
      pdfMetadata: pdfMetadata
        ? (serializeJsonColumn(pdfMetadata) as unknown as PdfMetadata)
        : null,
      category: sanitized.category ?? null,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  } catch (error) {
    console.error('articles-db: createArticleRecord failed', error);
    throw error;
  }
}

export async function verifyArticleOwnership(articleId: string, userId: string): Promise<boolean> {
  try {
    const rows = await db
      .select({ userId: articles.userId })
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);
    const row = rows[0];
    if (!row) return false;
    return row.userId === userId;
  } catch (error) {
    console.error('articles-db: verifyArticleOwnership failed', error);
    return false;
  }
}

export async function fetchAllTags(userId: string): Promise<string[]> {
  try {
    const rows = await db
      .select({ tags: articles.tags })
      .from(articles)
      .where(eq(articles.userId, userId));

    const tagsSet = new Set<string>();
    for (const row of rows) {
      const parsed = parseJsonColumn<string[]>(row.tags, []);
      for (const tag of normalizeTags(parsed)) {
        tagsSet.add(tag);
      }
    }
    return Array.from(tagsSet).sort();
  } catch (error) {
    console.error('articles-db: fetchAllTags failed', error);
    throw error;
  }
}

export interface SearchResult {
  id: string;
  url: string;
  title: string;
  byline?: string | null;
  projectId?: string;
  status?: ArticleStatus;
  notesCount: number;
  createdAt?: string;
  updatedAt?: string;
  matchedFields: string[];
  snippets: {
    field: string;
    text: string;
  }[];
  relevanceScore: number;
  listIds?: string[];
  category?: string;
}

function stripHtmlTags(html: string): string {
  return sanitizePlainText(html);
}

function highlightSearchTerms(text: string, query: string): string {
  if (!query.trim()) return text;
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  let result = text;
  terms.forEach((term) => {
    const regex = new RegExp(`(${term})`, 'gi');
    result = result.replace(regex, '**$1**');
  });
  return result;
}

function getSnippet(text: string, query: string, maxLength = 150): string {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const terms = lowerQuery.split(/\s+/).filter((t) => t.length > 0);

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
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  return highlightSearchTerms(snippet, query);
}

function calculateRelevance(
  query: string,
  title: string,
  content: string,
  notes: Note[],
  aiChat: AIChatMessage[]
): number {
  const lowerQuery = query.toLowerCase();
  const terms = lowerQuery.split(/\s+/).filter((t) => t.length > 0);
  let score = 0;

  const lowerTitle = title.toLowerCase();
  terms.forEach((term) => {
    if (lowerTitle.includes(term)) score += 10;
  });

  const lowerContent = stripHtmlTags(content).toLowerCase();
  terms.forEach((term) => {
    const matches = (lowerContent.match(new RegExp(term, 'gi')) || []).length;
    score += matches * 2;
  });

  notes.forEach((note) => {
    const lowerNote = note.text.toLowerCase();
    terms.forEach((term) => {
      if (lowerNote.includes(term)) score += 5;
    });
  });

  aiChat.forEach((message) => {
    const lowerMessage = message.content.toLowerCase();
    terms.forEach((term) => {
      if (lowerMessage.includes(term)) score += 3;
    });
  });

  return score;
}

function matchesQuery(
  query: string,
  title: string,
  content: string,
  notes: Note[],
  aiChat: AIChatMessage[]
): boolean {
  const lowerQuery = query.toLowerCase();
  const terms = lowerQuery.split(/\s+/).filter((t) => t.length > 0);
  if (terms.length === 0) return false;

  const lowerTitle = title.toLowerCase();
  const lowerContent = stripHtmlTags(content).toLowerCase();
  const notesText = notes.map((n) => n.text.toLowerCase()).join(' ');
  const chatText = aiChat.map((m) => m.content.toLowerCase()).join(' ');

  return terms.every(
    (term) =>
      lowerTitle.includes(term) ||
      lowerContent.includes(term) ||
      notesText.includes(term) ||
      chatText.includes(term)
  );
}

// Follow-up: upgrade to SQL LIKE or FTS5 once dataset grows; current impl is in-memory.
export async function searchArticles(
  userId: string,
  query: string,
  projectId?: string
): Promise<SearchResult[]> {
  // projectId is retained for signature parity with articles-service; the
  // Turso schema drops the column, so filtering is a no-op here.
  void projectId;
  const sanitizedQuery = sanitizePlainText(query);
  if (!sanitizedQuery || sanitizedQuery.length < 2) return [];

  try {
    const rows = await db.select().from(articles).where(eq(articles.userId, userId));

    const results: SearchResult[] = [];
    for (const row of rows) {
      const title = row.title || row.url || '';
      const content = row.content || '';
      const notes = parseJsonColumn<Note[]>(row.notes, []);
      const aiChat = normalizeAIChatMessages(parseJsonColumn<AIChatMessage[]>(row.aiChat, []));

      if (!matchesQuery(sanitizedQuery, title, content, notes, aiChat)) continue;

      const matchedFields: string[] = [];
      const snippets: { field: string; text: string }[] = [];
      const lowerQuery = sanitizedQuery.toLowerCase();

      if (title.toLowerCase().includes(lowerQuery)) {
        matchedFields.push('title');
        snippets.push({ field: 'title', text: highlightSearchTerms(title, sanitizedQuery) });
      }

      const plainContent = stripHtmlTags(content);
      if (plainContent.toLowerCase().includes(lowerQuery)) {
        matchedFields.push('content');
        snippets.push({ field: 'content', text: getSnippet(plainContent, sanitizedQuery) });
      }

      const matchingNotes = notes.filter((note) => note.text.toLowerCase().includes(lowerQuery));
      if (matchingNotes.length > 0) {
        matchedFields.push('notes');
        snippets.push({
          field: 'notes',
          text: getSnippet(matchingNotes[0].text, sanitizedQuery, 100),
        });
      }

      const matchingChat = aiChat.filter((msg) => msg.content.toLowerCase().includes(lowerQuery));
      if (matchingChat.length > 0) {
        matchedFields.push('aiChat');
        snippets.push({
          field: 'aiChat',
          text: getSnippet(matchingChat[0].content, sanitizedQuery, 100),
        });
      }

      const relevanceScore = calculateRelevance(sanitizedQuery, title, content, notes, aiChat);
      const listIds = parseJsonColumn<string[]>(row.listIds, []);

      results.push({
        id: row.id,
        url: row.url,
        title,
        byline: row.byline ?? undefined,
        projectId: defaultProjectId(userId),
        status: normalizeStatus(row.status),
        notesCount: notes.length,
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
        matchedFields,
        snippets,
        relevanceScore,
        listIds: Array.isArray(listIds) ? listIds : [],
        category: row.category ?? undefined,
      });
    }

    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return results;
  } catch (error) {
    console.error('articles-db: searchArticles failed', error);
    throw error;
  }
}

export async function generateArticleShareId(
  articleId: string,
  userId: string
): Promise<string | null> {
  try {
    const rows = await db
      .select({ userId: articles.userId, shareId: articles.shareId })
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    if (row.userId !== userId) return null;
    if (row.shareId) return row.shareId;

    const shareId = crypto.randomBytes(16).toString('base64url');
    await db
      .update(articles)
      .set({ shareId, updatedAt: new Date() })
      .where(eq(articles.id, articleId));
    return shareId;
  } catch (error) {
    console.error('articles-db: generateArticleShareId failed', error);
    throw error;
  }
}

export async function revokeArticleShareId(articleId: string, userId: string): Promise<boolean> {
  try {
    const rows = await db
      .select({ userId: articles.userId })
      .from(articles)
      .where(eq(articles.id, articleId))
      .limit(1);
    const row = rows[0];
    if (!row) return false;
    if (row.userId !== userId) return false;

    await db
      .update(articles)
      .set({ shareId: null, updatedAt: new Date() })
      .where(eq(articles.id, articleId));
    return true;
  } catch (error) {
    console.error('articles-db: revokeArticleShareId failed', error);
    throw error;
  }
}

export async function fetchArticleByShareId(
  shareId: string
): Promise<Omit<Article, 'userId' | 'id' | 'aiChat'> | null> {
  try {
    const rows = await db.select().from(articles).where(eq(articles.shareId, shareId)).limit(1);
    const row = rows[0];
    if (!row) return null;

    const notes = parseJsonColumn<Note[]>(row.notes, []);
    const tags = parseJsonColumn<string[]>(row.tags, []);
    const summary = parseJsonColumn<Record<string, string> | string | null>(row.summary, null);
    const keyPoints = parseJsonColumn<string[] | null>(row.keyPoints, null);
    const pdfMetadata = parseJsonColumn<PdfMetadata | null>(row.pdfMetadata, null);

    const aiSummary =
      typeof summary === 'string'
        ? summary
        : summary && typeof summary.medium === 'string'
          ? summary.medium
          : undefined;

    return {
      url: row.url,
      title: row.title || row.url,
      byline: row.byline ?? undefined,
      content: row.content ?? '',
      notes: notes.map((n) => ({
        id: Number((n as { id?: unknown }).id) || 0,
        text: String((n as { text?: unknown }).text || ''),
        anchor: (n as { anchor?: Note['anchor'] }).anchor,
      })),
      aiSummary,
      keyPoints: Array.isArray(keyPoints) ? keyPoints : undefined,
      tags: Array.isArray(tags) ? tags : [],
      readingTimeMinutes:
        typeof row.readingTimeMinutes === 'number' ? row.readingTimeMinutes : undefined,
      type: normalizeArticleType(row.type),
      pdfMetadata: pdfMetadata ?? undefined,
      shareId: row.shareId ?? undefined,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  } catch (error) {
    console.error('articles-db: fetchArticleByShareId failed', error);
    throw error;
  }
}

const LOCAL_ONLY_AI_SETTINGS_FIELDS = new Set([
  'provider',
  'model',
  'apiKey',
  'systemPrompt',
  'aiConfig',
]);

function normalizeKeyPointsInput(payload: unknown): string[] | null {
  if (!Array.isArray(payload)) return null;
  const normalized = payload
    .map((point) => sanitizePlainText(point).slice(0, 500))
    .filter((point) => point.length > 0)
    .slice(0, 10);
  return normalized.length > 0 ? normalized : null;
}

function normalizeUpdateStatus(status: unknown): ArticleStatus | null {
  return status === 'read' || status === 'in_progress' ? status : null;
}

export class ArticleUpdateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArticleUpdateValidationError';
  }
}

/**
 * Apply partial updates to an article. Mirrors the field whitelist that the
 * old PUT /api/articles/[id] handler enforced against Firestore.
 *
 * Throws ArticleUpdateValidationError on client-side misuse (e.g. attempting
 * to persist local-only AI settings).
 */
export async function updateArticle(
  id: string,
  userId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const localOnlyField = Object.keys(payload).find((key) => LOCAL_ONLY_AI_SETTINGS_FIELDS.has(key));
  if (localOnlyField) {
    throw new ArticleUpdateValidationError(
      `${localOnlyField} is local-only and must not be sent to article persistence.`
    );
  }

  const { notes, aiChat, title, status, tags, aiSummary, keyPoints, category, sessionReview } =
    payload;
  const updates: Partial<typeof articles.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (notes !== undefined) {
    const normalized = normalizeNotes(notes);
    updates.notes = serializeJsonColumn(normalized) as unknown as Note[];
  }

  if (aiChat !== undefined) {
    const normalized = normalizeAIChatMessages(aiChat);
    updates.aiChat = serializeJsonColumn(normalized) as unknown as AIChatMessage[];
  }

  if (typeof title === 'string') {
    const trimmedTitle = sanitizeTitle(title);
    if (trimmedTitle.length > 0) {
      updates.title = trimmedTitle;
    }
  }

  const normalizedStatus = normalizeUpdateStatus(status);
  if (normalizedStatus) {
    updates.status = normalizedStatus;
  }

  if (tags !== undefined) {
    const normalized = normalizeTags(tags);
    updates.tags = serializeJsonColumn(normalized) as unknown as string[];
  }

  if (typeof category === 'string') {
    const trimmedCategory = sanitizePlainText(category).slice(0, 50);
    updates.category = trimmedCategory.length > 0 ? trimmedCategory : null;
  }

  if (typeof aiSummary === 'string') {
    const trimmedSummary = sanitizePlainText(aiSummary).slice(0, 5000);
    updates.summary =
      trimmedSummary.length > 0
        ? (serializeJsonColumn({ medium: trimmedSummary }) as unknown as {
            short?: string;
            medium?: string;
            long?: string;
          })
        : null;
  }

  if (keyPoints !== undefined) {
    const normalizedKeyPoints = normalizeKeyPointsInput(keyPoints);
    updates.keyPoints = normalizedKeyPoints
      ? (serializeJsonColumn(normalizedKeyPoints) as unknown as string[])
      : null;
  }

  if (sessionReview !== undefined && sessionReview !== null && typeof sessionReview === 'object') {
    updates.sessionReview = serializeJsonColumn(sessionReview) as unknown as SessionReview;
  }

  try {
    await db
      .update(articles)
      .set(updates)
      .where(and(eq(articles.id, id), eq(articles.userId, userId)));
  } catch (error) {
    console.error('articles-db: updateArticle failed', error);
    throw error;
  }

  // Bust the edge cache so the next read returns the fresh row.
  await invalidateArticleCache(id, userId);
}

export async function deleteArticle(id: string, userId: string): Promise<void> {
  try {
    await db.delete(articles).where(and(eq(articles.id, id), eq(articles.userId, userId)));
  } catch (error) {
    console.error('articles-db: deleteArticle failed', error);
    throw error;
  }

  await invalidateArticleCache(id, userId);
}
