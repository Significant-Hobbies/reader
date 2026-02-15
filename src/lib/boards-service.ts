import { Timestamp } from 'firebase-admin/firestore';
import { db } from './firebase-admin';
import { sanitizePlainText, sanitizeTitle } from './articles-service';
import type { Board, BoardEdge, BoardNode, BoardSummary, AIChatMessage } from '../types';

const MAX_NODES = 200;
const MAX_EDGES = 500;
const MAX_AI_MESSAGES_PER_NODE = 80;
const MAX_AI_MESSAGE_LENGTH = 4000;
const MAX_NOTE_TEXT_LENGTH = 5000;

const COLLECTION = 'boards';

function sanitizeBoardNode(node: unknown): BoardNode | null {
  if (typeof node !== 'object' || node === null) return null;
  const n = node as Record<string, unknown>;

  const id = typeof n.id === 'string' ? n.id.trim() : '';
  if (!id) return null;

  const type = n.type;
  if (type !== 'website' && type !== 'note' && type !== 'aiChat' && type !== 'iframe') return null;

  const pos = n.position as Record<string, unknown> | undefined;
  const x = Number(pos?.x ?? 0);
  const y = Number(pos?.y ?? 0);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

  const base = {
    id,
    type,
    position: { x, y },
    width: typeof n.width === 'number' && Number.isFinite(n.width) ? n.width : undefined,
    height: typeof n.height === 'number' && Number.isFinite(n.height) ? n.height : undefined,
  };

  const data = n.data as Record<string, unknown> | undefined;
  if (!data || typeof data !== 'object') return null;

  if (type === 'website') {
    return {
      ...base,
      type: 'website',
      data: {
        url: sanitizePlainText(data.url).slice(0, 2048),
        title: sanitizeTitle(data.title, 'Untitled'),
        excerpt: sanitizePlainText(data.excerpt).slice(0, 500),
        favicon: typeof data.favicon === 'string' ? data.favicon.slice(0, 2048) : undefined,
        articleId: typeof data.articleId === 'string' ? data.articleId.trim() : undefined,
      },
    };
  }

  if (type === 'note') {
    return {
      ...base,
      type: 'note',
      data: {
        text: sanitizePlainText(data.text).slice(0, MAX_NOTE_TEXT_LENGTH),
        color: typeof data.color === 'string' ? data.color.slice(0, 20) : 'yellow',
      },
    };
  }

  if (type === 'iframe') {
    return {
      ...base,
      type: 'iframe',
      data: {
        url: sanitizePlainText(data.url).slice(0, 2048),
        title: typeof data.title === 'string' ? sanitizeTitle(data.title, '') : undefined,
      },
    };
  }

  // aiChat
  const messages = Array.isArray(data.messages) ? data.messages : [];
  const sanitizedMessages: AIChatMessage[] = messages
    .map((m: unknown) => {
      if (typeof m !== 'object' || m === null) return null;
      const msg = m as Record<string, unknown>;
      if (msg.role !== 'user' && msg.role !== 'assistant') return null;
      const content = sanitizePlainText(msg.content).slice(0, MAX_AI_MESSAGE_LENGTH);
      if (!content) return null;
      return { role: msg.role as 'user' | 'assistant', content };
    })
    .filter((m): m is AIChatMessage => m !== null)
    .slice(-MAX_AI_MESSAGES_PER_NODE);

  return {
    ...base,
    type: 'aiChat',
    data: {
      messages: sanitizedMessages,
      contextLabel:
        typeof data.contextLabel === 'string'
          ? sanitizePlainText(data.contextLabel).slice(0, 200)
          : undefined,
    },
  };
}

function sanitizeBoardEdge(edge: unknown): BoardEdge | null {
  if (typeof edge !== 'object' || edge === null) return null;
  const e = edge as Record<string, unknown>;

  const id = typeof e.id === 'string' ? e.id.trim() : '';
  const source = typeof e.source === 'string' ? e.source.trim() : '';
  const target = typeof e.target === 'string' ? e.target.trim() : '';
  if (!id || !source || !target) return null;

  return {
    id,
    source,
    target,
    label: typeof e.label === 'string' ? sanitizePlainText(e.label).slice(0, 200) : undefined,
    style: e.style === 'dashed' ? 'dashed' : 'solid',
  };
}

export function sanitizeNodes(nodes: unknown): BoardNode[] {
  if (!Array.isArray(nodes)) return [];
  return nodes
    .map(sanitizeBoardNode)
    .filter((n): n is BoardNode => n !== null)
    .slice(0, MAX_NODES);
}

export function sanitizeEdges(edges: unknown): BoardEdge[] {
  if (!Array.isArray(edges)) return [];
  return edges
    .map(sanitizeBoardEdge)
    .filter((e): e is BoardEdge => e !== null)
    .slice(0, MAX_EDGES);
}

export async function fetchBoardSummaries(userId: string): Promise<BoardSummary[]> {
  const snapshot = await db
    .collection(COLLECTION)
    .where('userId', '==', userId)
    .orderBy('updatedAt', 'desc')
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name || 'Untitled Board',
      nodeCount: Array.isArray(data.nodes) ? data.nodes.length : 0,
      createdAt: data.createdAt?.toDate().toISOString(),
      updatedAt: data.updatedAt?.toDate().toISOString(),
    };
  });
}

export async function fetchBoardById(id: string, userId: string): Promise<Board | null> {
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  const data = doc.data()!;
  if (data.userId !== userId) return null;

  return {
    id: doc.id,
    userId: data.userId,
    name: data.name || 'Untitled Board',
    nodes: sanitizeNodes(data.nodes),
    edges: sanitizeEdges(data.edges),
    createdAt: data.createdAt?.toDate().toISOString(),
    updatedAt: data.updatedAt?.toDate().toISOString(),
  };
}

export async function createBoard(name: string, userId: string): Promise<string> {
  const sanitizedName = sanitizeTitle(name, 'Untitled Board');
  const now = Timestamp.now();
  const ref = await db.collection(COLLECTION).add({
    userId,
    name: sanitizedName,
    nodes: [],
    edges: [],
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export async function verifyBoardOwnership(boardId: string, userId: string): Promise<boolean> {
  const doc = await db.collection(COLLECTION).doc(boardId).get();
  if (!doc.exists) return false;
  return doc.data()!.userId === userId;
}
