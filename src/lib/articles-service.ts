import { Timestamp } from 'firebase-admin/firestore';
import sanitizeHtml from 'sanitize-html';
import type { IOptions } from 'sanitize-html';
import { db } from './firebase-admin';
import { AIChatMessage, Article, ArticleStatus, ArticleSummary, Note, Project } from '../types';

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

export const sanitizePlainText = (value: unknown) =>
  sanitizeHtml(String(value ?? ''), plainTextSanitizeOptions).trim();

const sanitizeHTML = (value: unknown) => sanitizeHtml(String(value ?? ''), htmlSanitizeOptions);

export const sanitizeTitle = (value: unknown, fallback = '') =>
  sanitizePlainText(value ?? fallback).slice(0, 500);

const DEFAULT_PROJECT_NAME = 'Default';

const normalizeStatus = (status: unknown): ArticleStatus => {
  return status === 'read' ? 'read' : 'in_progress';
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

/**
 * Calculate reading time in minutes from HTML content
 * Uses 225 words per minute as the standard reading speed
 */
export function calculateReadingTime(htmlContent: string): number {
  // Strip HTML tags to get plain text
  const plainText = sanitizePlainText(htmlContent);

  // Count words (split by whitespace and filter out empty strings)
  const words = plainText.split(/\s+/).filter((word) => word.length > 0);
  const wordCount = words.length;

  // Calculate reading time (225 words per minute)
  const WORDS_PER_MINUTE = 225;
  const minutes = wordCount / WORDS_PER_MINUTE;

  // Round to nearest minute, minimum 1 minute for any content
  return Math.max(1, Math.round(minutes));
}

/**
 * Format reading time for display
 */
export function formatReadingTime(minutes?: number): string {
  if (!minutes || minutes < 1) return '< 1 min read';

  // For articles over 60 minutes, show hours
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      return `${hours} hr read`;
    }
    return `${hours} hr ${remainingMinutes} min read`;
  }

  return `${minutes} min read`;
}

export async function fetchArticleSummaries(
  userId: string,
  projectId?: string
): Promise<ArticleSummary[]> {
  let query = db
    .collection('annotations')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc');

  if (projectId && projectId !== 'all') {
    query = db
      .collection('annotations')
      .where('userId', '==', userId)
      .where('projectId', '==', projectId);
  }

  const snapshot = await query.get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    const status = normalizeStatus(data.status);
    return {
      id: doc.id,
      url: data.url,
      title: data.title || data.url,
      byline: data.byline,
      projectId: data.projectId || defaultProjectId(userId),
      status,
      tags: normalizeTags(data.tags),
      readingTimeMinutes:
        typeof data.readingTimeMinutes === 'number' ? data.readingTimeMinutes : undefined,
      type: data.type || 'article',
      pdfUrl: data.pdfUrl,
      pdfMetadata: data.pdfMetadata,
      notesCount:
        typeof data.notesCount === 'number'
          ? data.notesCount
          : Array.isArray(data.notes)
            ? data.notes.length
            : 0,
      createdAt: data.createdAt?.toDate().toISOString(),
      updatedAt: data.updatedAt?.toDate().toISOString(),
    };
  });
}

export async function fetchArticleById(id: string, userId: string): Promise<Article | null> {
  const doc = await db.collection('annotations').doc(id).get();
  if (!doc.exists) return null;
  const data = doc.data()!;

  // Ownership check — allow legacy docs (no userId) through
  if (data.userId && data.userId !== userId) return null;

  const status = normalizeStatus(data.status);
  return {
    id: doc.id,
    url: data.url,
    title: data.title,
    byline: data.byline,
    content: data.content,
    notes: data.notes ?? [],
    aiChat: normalizeAIChatMessages(data.aiChat),
    aiSummary: typeof data.aiSummary === 'string' ? data.aiSummary : undefined,
    keyPoints: Array.isArray(data.keyPoints) ? data.keyPoints : undefined,
    projectId: data.projectId || defaultProjectId(userId),
    status,
    tags: normalizeTags(data.tags),
    readingTimeMinutes:
      typeof data.readingTimeMinutes === 'number' ? data.readingTimeMinutes : undefined,
    type: data.type || 'article',
    pdfUrl: data.pdfUrl,
    extractedText: data.extractedText,
    pdfMetadata: data.pdfMetadata,
    notesCount:
      typeof data.notesCount === 'number'
        ? data.notesCount
        : Array.isArray(data.notes)
          ? data.notes.length
          : 0,
    createdAt: data.createdAt?.toDate().toISOString(),
    updatedAt: data.updatedAt?.toDate().toISOString(),
  };
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
        if (normalizedAnchor) {
          normalizedNote.anchor = normalizedAnchor;
        }
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

      return {
        role: message.role,
        content,
      } as AIChatMessage;
    })
    .filter((message): message is AIChatMessage => Boolean(message))
    .slice(-MAX_AI_CHAT_MESSAGES);
}

export function sanitizeArticlePayload(payload: {
  url: string;
  title?: string;
  byline?: string;
  content: string;
  projectId?: string;
  tags?: string[];
  userId: string;
  type?: 'article' | 'pdf';
  pdfUrl?: string;
  extractedText?: string;
  pdfMetadata?: {
    pageCount?: number;
    fileSize?: number;
  };
}) {
  const sanitizedUrl = sanitizePlainText(payload.url);
  if (!sanitizedUrl) {
    throw new Error('URL is required');
  }

  const defProjectId = defaultProjectId(payload.userId);

  const base = {
    url: sanitizedUrl,
    title: sanitizeTitle(payload.title, sanitizedUrl),
    byline: sanitizePlainText(payload.byline || ''),
    content: sanitizeHTML(payload.content),
    projectId: sanitizePlainText(payload.projectId || defProjectId) || defProjectId,
    tags: normalizeTags(payload.tags),
    userId: payload.userId,
    type: payload.type || 'article',
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

export async function createArticleRecord(payload: {
  url: string;
  title?: string;
  byline?: string;
  content: string;
  projectId?: string;
  tags?: string[];
  userId: string;
  type?: 'article' | 'pdf';
  pdfUrl?: string;
  extractedText?: string;
  pdfMetadata?: {
    pageCount?: number;
    fileSize?: number;
  };
}) {
  const sanitized = sanitizeArticlePayload(payload);

  // Calculate reading time from content
  const readingTimeMinutes = calculateReadingTime(sanitized.content);

  const now = Timestamp.now();
  const docRef = await db.collection('annotations').add({
    ...sanitized,
    notes: [],
    aiChat: [],
    notesCount: 0,
    status: 'in_progress',
    readingTimeMinutes,
    createdAt: now,
    updatedAt: now,
  });
  return docRef.id;
}

function defaultProjectId(userId: string) {
  return `${userId}_default`;
}

const sanitizeProjectName = (value: unknown) => sanitizeTitle(value, DEFAULT_PROJECT_NAME);

export async function ensureDefaultProject(userId: string): Promise<Project> {
  const docId = defaultProjectId(userId);
  const defaultRef = db.collection('projects').doc(docId);
  const snapshot = await defaultRef.get();
  if (!snapshot.exists) {
    const now = Timestamp.now();
    await defaultRef.set({
      name: DEFAULT_PROJECT_NAME,
      userId,
      createdAt: now,
      updatedAt: now,
    });
  }
  const fresh = await defaultRef.get();
  const data = fresh.data() || {};
  return {
    id: docId,
    name: data.name || DEFAULT_PROJECT_NAME,
    createdAt: data.createdAt?.toDate().toISOString(),
    updatedAt: data.updatedAt?.toDate().toISOString(),
  };
}

export async function fetchProjects(userId: string): Promise<Project[]> {
  const defaultProject = await ensureDefaultProject(userId);
  const snapshot = await db
    .collection('projects')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .get();

  const projects: Project[] = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name || DEFAULT_PROJECT_NAME,
      createdAt: data.createdAt?.toDate().toISOString(),
      updatedAt: data.updatedAt?.toDate().toISOString(),
    };
  });

  const merged = [defaultProject, ...projects.filter((p) => p.id !== defaultProject.id)];
  const seen = new Set<string>();
  return merged.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

export async function createProject(name: string, userId: string): Promise<string> {
  const sanitizedName = sanitizeProjectName(name);
  if (!sanitizedName) {
    throw new Error('Project name is required');
  }
  const now = Timestamp.now();
  const ref = await db.collection('projects').add({
    name: sanitizedName,
    userId,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function moveArticlesToDefault(projectId: string, userId: string) {
  const defId = defaultProjectId(userId);
  if (projectId === defId) return;
  const snapshot = await db.collection('annotations').where('projectId', '==', projectId).get();
  const batch = db.batch();
  snapshot.forEach((doc) => {
    batch.update(doc.ref, { projectId: defId, updatedAt: Timestamp.now() });
  });
  if (!snapshot.empty) {
    await batch.commit();
  }
}

export async function deleteProject(projectId: string, userId: string) {
  const defId = defaultProjectId(userId);
  if (projectId === defId) {
    throw new Error('Cannot delete default project');
  }

  // Verify ownership
  const doc = await db.collection('projects').doc(projectId).get();
  if (!doc.exists) throw new Error('Project not found');
  const data = doc.data()!;
  if (data.userId && data.userId !== userId) throw new Error('Not authorized');

  await moveArticlesToDefault(projectId, userId);
  await db.collection('projects').doc(projectId).delete();
}

export async function verifyArticleOwnership(articleId: string, userId: string): Promise<boolean> {
  const doc = await db.collection('annotations').doc(articleId).get();
  if (!doc.exists) return false;
  const data = doc.data()!;
  // Allow legacy docs (no userId)
  if (data.userId && data.userId !== userId) return false;
  return true;
}

export async function fetchAllTags(userId: string): Promise<string[]> {
  const snapshot = await db
    .collection('annotations')
    .where('userId', '==', userId)
    .select('tags')
    .get();

  const tagsSet = new Set<string>();
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const tags = normalizeTags(data.tags);
    tags.forEach((tag) => tagsSet.add(tag));
  });

  return Array.from(tagsSet).sort();
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

export async function searchArticles(
  userId: string,
  query: string,
  projectId?: string
): Promise<SearchResult[]> {
  const sanitizedQuery = sanitizePlainText(query);
  if (!sanitizedQuery || sanitizedQuery.length < 2) {
    return [];
  }

  let dbQuery = db.collection('annotations').where('userId', '==', userId);

  if (projectId && projectId !== 'all') {
    dbQuery = dbQuery.where('projectId', '==', projectId);
  }

  const snapshot = await dbQuery.get();

  const results: SearchResult[] = [];

  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    const title = data.title || data.url || '';
    const content = data.content || '';
    const notes: Note[] = Array.isArray(data.notes) ? data.notes : [];
    const aiChat: AIChatMessage[] = normalizeAIChatMessages(data.aiChat);

    if (!matchesQuery(sanitizedQuery, title, content, notes, aiChat)) {
      return;
    }

    const matchedFields: string[] = [];
    const snippets: { field: string; text: string }[] = [];

    const lowerQuery = sanitizedQuery.toLowerCase();
    if (title.toLowerCase().includes(lowerQuery)) {
      matchedFields.push('title');
      snippets.push({
        field: 'title',
        text: highlightSearchTerms(title, sanitizedQuery),
      });
    }

    const plainContent = stripHtmlTags(content);
    if (plainContent.toLowerCase().includes(lowerQuery)) {
      matchedFields.push('content');
      snippets.push({
        field: 'content',
        text: getSnippet(plainContent, sanitizedQuery),
      });
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

    const status = normalizeStatus(data.status);
    results.push({
      id: doc.id,
      url: data.url,
      title: title,
      byline: data.byline,
      projectId: data.projectId || defaultProjectId(userId),
      status,
      notesCount: typeof data.notesCount === 'number' ? data.notesCount : notes.length,
      createdAt: data.createdAt?.toDate().toISOString(),
      updatedAt: data.updatedAt?.toDate().toISOString(),
      matchedFields,
      snippets,
      relevanceScore,
    });
  });

  results.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return results;
}
