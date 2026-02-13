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
    projectId: data.projectId || defaultProjectId(userId),
    status,
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
  userId: string;
}) {
  const sanitizedUrl = sanitizePlainText(payload.url);
  if (!sanitizedUrl) {
    throw new Error('URL is required');
  }

  const defProjectId = defaultProjectId(payload.userId);

  return {
    url: sanitizedUrl,
    title: sanitizeTitle(payload.title, sanitizedUrl),
    byline: sanitizePlainText(payload.byline || ''),
    content: sanitizeHTML(payload.content),
    projectId: sanitizePlainText(payload.projectId || defProjectId) || defProjectId,
    userId: payload.userId,
  };
}

export async function createArticleRecord(payload: {
  url: string;
  title?: string;
  byline?: string;
  content: string;
  projectId?: string;
  userId: string;
}) {
  const sanitized = sanitizeArticlePayload(payload);
  const now = Timestamp.now();
  const docRef = await db.collection('annotations').add({
    ...sanitized,
    notes: [],
    aiChat: [],
    notesCount: 0,
    status: 'in_progress',
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
