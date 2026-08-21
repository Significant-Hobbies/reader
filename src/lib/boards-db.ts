import crypto from 'crypto';
import { and, desc, eq } from 'drizzle-orm';

import type { AIChatMessage, Board, BoardEdge, BoardNode, BoardSummary } from '../types';
import { sanitizePlainText, sanitizeTitle } from './articles-db';
import { db } from './db/client';
import { boards } from './db/schema';

// ---------------------------------------------------------------------------
// Board sanitizers (previously in boards-service.ts)
// ---------------------------------------------------------------------------

const MAX_NODES = 200;
const MAX_EDGES = 500;
const MAX_AI_MESSAGES_PER_NODE = 80;
const MAX_AI_MESSAGE_LENGTH = 4000;
const MAX_NOTE_TEXT_LENGTH = 5000;

function sanitizeElementAnchor(anchor: unknown): Record<string, unknown> | undefined {
  if (typeof anchor !== 'object' || anchor === null) return undefined;
  const a = anchor as Record<string, unknown>;
  const articleId = typeof a.articleId === 'string' ? a.articleId.trim() : '';
  const websiteNodeId = typeof a.websiteNodeId === 'string' ? a.websiteNodeId.trim() : '';
  const elementIndex = Number(a.elementIndex);
  if (!articleId || !websiteNodeId || !Number.isFinite(elementIndex) || elementIndex < 0)
    return undefined;
  const result: Record<string, unknown> = { articleId, websiteNodeId, elementIndex };
  if (typeof a.tagName === 'string') result.tagName = a.tagName.slice(0, 30);
  if (typeof a.textPreview === 'string')
    result.textPreview = sanitizePlainText(a.textPreview).slice(0, 200);
  return result;
}

function sanitizeWebsiteData(data: Record<string, unknown>): Record<string, unknown> {
  const websiteData: Record<string, unknown> = {
    url: sanitizePlainText(data.url).slice(0, 2048),
    title: sanitizeTitle(data.title, 'Untitled'),
    excerpt: sanitizePlainText(data.excerpt).slice(0, 500),
  };
  if (typeof data.favicon === 'string') websiteData.favicon = data.favicon.slice(0, 2048);
  if (typeof data.articleId === 'string' && data.articleId.trim())
    websiteData.articleId = data.articleId.trim();
  return websiteData;
}

function sanitizeNoteData(data: Record<string, unknown>): Record<string, unknown> {
  const noteData: Record<string, unknown> = {
    text: sanitizePlainText(data.text).slice(0, MAX_NOTE_TEXT_LENGTH),
    color: typeof data.color === 'string' ? data.color.slice(0, 20) : 'yellow',
  };
  const anchor = sanitizeElementAnchor(data.elementAnchor);
  if (anchor) noteData.elementAnchor = anchor;
  return noteData;
}

function sanitizeIframeData(data: Record<string, unknown>): Record<string, unknown> {
  const iframeData: Record<string, unknown> = { url: sanitizePlainText(data.url).slice(0, 2048) };
  if (typeof data.title === 'string') iframeData.title = sanitizeTitle(data.title, '');
  return iframeData;
}

function sanitizeReaderData(data: Record<string, unknown>): Record<string, unknown> | null {
  const readerData: Record<string, unknown> = {
    articleId: typeof data.articleId === 'string' ? data.articleId.trim() : '',
    url: sanitizePlainText(data.url).slice(0, 2048),
    title: sanitizeTitle(data.title, 'Untitled'),
  };
  if (!readerData.articleId) return null;
  return readerData;
}

const SANITIZE_BY_TYPE: Record<
  string,
  (data: Record<string, unknown>) => Record<string, unknown> | null
> = {
  website: sanitizeWebsiteData,
  note: sanitizeNoteData,
  iframe: sanitizeIframeData,
  reader: sanitizeReaderData,
};

const VALID_NODE_TYPES = new Set(['website', 'note', 'aiChat', 'iframe', 'reader']);

function sanitizeBoardEdge(edge: unknown): BoardEdge | null {
  if (typeof edge !== 'object' || edge === null) return null;
  const e = edge as Record<string, unknown>;
  const id = typeof e.id === 'string' ? e.id.trim() : '';
  const source = typeof e.source === 'string' ? e.source.trim() : '';
  const target = typeof e.target === 'string' ? e.target.trim() : '';
  if (!id || !source || !target) return null;
  const result: Record<string, unknown> = {
    id,
    source,
    target,
    style: e.style === 'dashed' ? 'dashed' : 'solid',
  };
  if (typeof e.label === 'string') result.label = sanitizePlainText(e.label).slice(0, 200);
  return result as unknown as BoardEdge;
}

function sanitizeNodes(nodes: unknown): BoardNode[] {
  if (!Array.isArray(nodes)) return [];
  return nodes
    .map(sanitizeBoardNode)
    .filter((n): n is BoardNode => n !== null)
    .slice(0, MAX_NODES);
}

function sanitizeEdges(edges: unknown): BoardEdge[] {
  if (!Array.isArray(edges)) return [];
  return edges
    .map(sanitizeBoardEdge)
    .filter((e): e is BoardEdge => e !== null)
    .slice(0, MAX_EDGES);
}

function parseJsonColumn<T>(raw: unknown, fallback: T): T {
  if (raw == null || raw === '') return fallback;
  if (typeof raw !== 'string') return raw as T;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error('boards-db: failed to parse json column', error);
    return fallback;
  }
}

function serializeJsonColumn(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  try {
    return JSON.stringify(value);
  } catch (error) {
    console.error('boards-db: failed to serialize json column', error);
    return null;
  }
}

function toIso(value: Date | number | null | undefined): string | undefined {
  if (value == null) return undefined;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

type BoardRow = typeof boards.$inferSelect;

export async function fetchBoardSummaries(userId: string): Promise<BoardSummary[]> {
  try {
    const rows = await db
      .select()
      .from(boards)
      .where(eq(boards.userId, userId))
      .orderBy(desc(boards.updatedAt));

    return rows.map((row: BoardRow) => {
      const nodes = parseJsonColumn<unknown[]>(row.nodes, []);
      return {
        id: row.id,
        name: row.name || 'Untitled Board',
        nodeCount: Array.isArray(nodes) ? nodes.length : 0,
        createdAt: toIso(row.createdAt),
        updatedAt: toIso(row.updatedAt),
      };
    });
  } catch (error) {
    console.error('boards-db: fetchBoardSummaries failed', error);
    throw error;
  }
}

export async function fetchBoardById(id: string, userId: string): Promise<Board | null> {
  try {
    const rows = await db.select().from(boards).where(eq(boards.id, id)).limit(1);
    const row = rows[0];
    if (!row) return null;
    if (row.userId !== userId) return null;

    return {
      id: row.id,
      userId: row.userId,
      name: row.name || 'Untitled Board',
      nodes: sanitizeNodes(parseJsonColumn<unknown[]>(row.nodes, [])),
      edges: sanitizeEdges(parseJsonColumn<unknown[]>(row.edges, [])),
      ...(row.shareId ? { shareId: row.shareId } : {}),
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  } catch (error) {
    console.error('boards-db: fetchBoardById failed', error);
    throw error;
  }
}

export async function createBoard(name: string, userId: string): Promise<string> {
  try {
    const sanitizedName = sanitizeTitle(name, 'Untitled Board');
    const now = new Date();
    const id = crypto.randomUUID();

    await db.insert(boards).values({
      id,
      userId,
      name: sanitizedName,
      nodes: serializeJsonColumn([]) as unknown as unknown[],
      edges: serializeJsonColumn([]) as unknown as unknown[],
      createdAt: now,
      updatedAt: now,
    });

    return id;
  } catch (error) {
    console.error('boards-db: createBoard failed', error);
    throw error;
  }
}

export async function verifyBoardOwnership(boardId: string, userId: string): Promise<boolean> {
  try {
    const rows = await db
      .select({ userId: boards.userId })
      .from(boards)
      .where(eq(boards.id, boardId))
      .limit(1);
    const row = rows[0];
    if (!row) return false;
    return row.userId === userId;
  } catch (error) {
    console.error('boards-db: verifyBoardOwnership failed', error);
    return false;
  }
}

export async function generateShareId(boardId: string, userId: string): Promise<string | null> {
  try {
    const rows = await db
      .select({ userId: boards.userId, shareId: boards.shareId })
      .from(boards)
      .where(eq(boards.id, boardId))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    if (row.userId !== userId) return null;
    if (row.shareId) return row.shareId;

    const shareId = crypto.randomBytes(16).toString('base64url');
    await db.update(boards).set({ shareId, updatedAt: new Date() }).where(eq(boards.id, boardId));
    return shareId;
  } catch (error) {
    console.error('boards-db: generateShareId failed', error);
    throw error;
  }
}

export async function revokeShareId(boardId: string, userId: string): Promise<boolean> {
  try {
    const rows = await db
      .select({ userId: boards.userId })
      .from(boards)
      .where(eq(boards.id, boardId))
      .limit(1);
    const row = rows[0];
    if (!row) return false;
    if (row.userId !== userId) return false;

    await db
      .update(boards)
      .set({ shareId: null, updatedAt: new Date() })
      .where(eq(boards.id, boardId));
    return true;
  } catch (error) {
    console.error('boards-db: revokeShareId failed', error);
    throw error;
  }
}

export async function fetchBoardByShareId(
  shareId: string
): Promise<Omit<Board, 'userId' | 'id'> | null> {
  try {
    const rows = await db.select().from(boards).where(eq(boards.shareId, shareId)).limit(1);
    const row = rows[0];
    if (!row) return null;

    const nodes = sanitizeNodes(parseJsonColumn<unknown[]>(row.nodes, [])).map((n) => {
      const nodeData = { ...(n.data as unknown as Record<string, unknown>) };
      delete nodeData.articleId;
      delete nodeData.elementAnchor;
      return { ...n, data: nodeData } as unknown as BoardNode;
    });

    return {
      name: row.name || 'Untitled Board',
      nodes,
      edges: sanitizeEdges(parseJsonColumn<unknown[]>(row.edges, [])),
      shareId: row.shareId ?? undefined,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
    };
  } catch (error) {
    console.error('boards-db: fetchBoardByShareId failed', error);
    throw error;
  }
}

/**
 * Apply partial updates to a board. Mirrors the field whitelist that the old
 * PUT /api/boards/[id] handler enforced against Firestore.
 */
export async function updateBoard(
  id: string,
  userId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const updates: Partial<typeof boards.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (typeof payload.name === 'string') {
    const trimmedName = sanitizeTitle(payload.name, 'Untitled Board');
    if (trimmedName.length > 0) {
      updates.name = trimmedName;
    }
  }

  if (payload.nodes !== undefined) {
    const normalized = sanitizeNodes(payload.nodes);
    updates.nodes = serializeJsonColumn(normalized) as unknown as unknown[];
  }

  if (payload.edges !== undefined) {
    const normalized = sanitizeEdges(payload.edges);
    updates.edges = serializeJsonColumn(normalized) as unknown as unknown[];
  }

  try {
    await db
      .update(boards)
      .set(updates)
      .where(and(eq(boards.id, id), eq(boards.userId, userId)));
  } catch (error) {
    console.error('boards-db: updateBoard failed', error);
    throw error;
  }
}

export async function deleteBoard(id: string, userId: string): Promise<void> {
  try {
    await db.delete(boards).where(and(eq(boards.id, id), eq(boards.userId, userId)));
  } catch (error) {
    console.error('boards-db: deleteBoard failed', error);
    throw error;
  }
}

function sanitizeAiChatNode(
  base: Record<string, unknown>,
  data: Record<string, unknown>
): BoardNode {
  const messages = Array.isArray(data.messages) ? data.messages : [];
  const sanitizedMessages: AIChatMessage[] = messages
    .map((m: unknown) => {
      if (typeof m !== 'object' || m === null) return null;
      const msg = m as Record<string, unknown>;
      if (msg.role !== 'user' && msg.role !== 'assistant') return null;
      const content = sanitizePlainText(msg.content).slice(0, MAX_AI_MESSAGE_LENGTH);
      if (!content) return null;
      const result: Record<string, unknown> = { role: msg.role, content };
      const msgAnchor = sanitizeElementAnchor(msg.elementAnchor);
      if (msgAnchor) result.elementAnchor = msgAnchor;
      return result as unknown as AIChatMessage;
    })
    .filter((m): m is AIChatMessage => m !== null)
    .slice(-MAX_AI_MESSAGES_PER_NODE);
  const chatData: Record<string, unknown> = { messages: sanitizedMessages };
  if (typeof data.contextLabel === 'string')
    chatData.contextLabel = sanitizePlainText(data.contextLabel).slice(0, 200);
  const chatAnchor = sanitizeElementAnchor(data.elementAnchor);
  if (chatAnchor) chatData.elementAnchor = chatAnchor;
  return { ...base, type: 'aiChat', data: chatData } as unknown as BoardNode;
}

function parseNodeBase(
  n: Record<string, unknown>
): { id: string; type: unknown; base: Record<string, unknown> } | null {
  const id = typeof n.id === 'string' ? n.id.trim() : '';
  if (!id) return null;
  const type = n.type;
  if (!VALID_NODE_TYPES.has(type as string)) return null;
  const pos = n.position as Record<string, unknown> | undefined;
  const x = Number(pos?.x ?? 0);
  const y = Number(pos?.y ?? 0);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const base: Record<string, unknown> = { id, type, position: { x, y } };
  if (typeof n.width === 'number' && Number.isFinite(n.width)) base.width = n.width;
  if (typeof n.height === 'number' && Number.isFinite(n.height)) base.height = n.height;
  return { id, type, base };
}

function sanitizeBoardNode(node: unknown): BoardNode | null {
  if (typeof node !== 'object' || node === null) return null;
  const parsed = parseNodeBase(node as Record<string, unknown>);
  if (!parsed) return null;
  const { type, base } = parsed;
  const data = (node as Record<string, unknown>).data as Record<string, unknown> | undefined;
  if (!data || typeof data !== 'object') return null;

  const sanitizeData = SANITIZE_BY_TYPE[type as string];
  if (sanitizeData) {
    const sanitizedData = sanitizeData(data);
    if (!sanitizedData) return null;
    return { ...base, type, data: sanitizedData } as unknown as BoardNode;
  }

  return sanitizeAiChatNode(base, data);
}
