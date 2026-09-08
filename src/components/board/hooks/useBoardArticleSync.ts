import type { Node } from '@xyflow/react';
import { useEffect, useRef, useState } from 'react';
import { boardNotes, BoardNoteSync } from '../../../lib/board-note-sync';
import type { AIChatMessage, ElementAnchor, Note } from '../../../types';

interface ArticleSnapshot {
  notes: Note[];
  chats: AIChatMessage[];
}

async function syncSnapshot(
  id: string,
  previous: ArticleSnapshot,
  next: ArticleSnapshot,
  noteSync: BoardNoteSync
) {
  if (JSON.stringify(previous.notes) !== JSON.stringify(next.notes)) {
    await noteSync.save(id, next.notes);
  }
  if (!next.chats.length || JSON.stringify(previous.chats) === JSON.stringify(next.chats)) return;
  const response = await fetch(`/api/articles/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ aiChat: next.chats }),
  });
  if (!response.ok) throw new Error('Could not sync the linked conversation.');
}

function snapshots(boardId: string, nodes: Node[]): Map<string, ArticleSnapshot> {
  const grouped = new Map<string, ArticleSnapshot>();
  for (const [id, notes] of boardNotes(boardId, nodes)) grouped.set(id, { notes, chats: [] });
  for (const node of nodes) {
    if (node.type !== 'aiChat') continue;
    const data = node.data as { messages: AIChatMessage[]; elementAnchor?: ElementAnchor };
    if (!data.elementAnchor?.articleId) continue;
    const id = data.elementAnchor.articleId;
    const entry = grouped.get(id) ?? { notes: [], chats: [] };
    entry.chats.push(...data.messages);
    grouped.set(id, entry);
  }
  return grouped;
}

export function useBoardArticleSync(boardId: string, nodes: Node[], enabled: boolean) {
  const [initial] = useState(() => snapshots(boardId, nodes));
  const [noteSync] = useState(() => new BoardNoteSync(boardNotes(boardId, nodes)));
  const acknowledged = useRef(initial);
  const queue = useRef(Promise.resolve());
  const active = useRef(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const retryGeneration = useRef(retry);
  retryGeneration.current = retry;

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const desired = snapshots(boardId, nodes);
    const timer = setTimeout(() => {
      queue.current = queue.current.then(async () => {
        if (!active.current || retry !== retryGeneration.current) return;
        for (const id of new Set([...acknowledged.current.keys(), ...desired.keys()])) {
          if (!active.current) return;
          const next = desired.get(id) ?? { notes: [], chats: [] };
          const previous = acknowledged.current.get(id) ?? { notes: [], chats: [] };
          if (JSON.stringify(previous) === JSON.stringify(next)) continue;
          try {
            await syncSnapshot(id, previous, next, noteSync);
            acknowledged.current.set(id, next);
            if (active.current) setError('');
          } catch (failure) {
            if (active.current)
              setError(failure instanceof Error ? failure.message : 'Linked article sync failed.');
            return;
          }
        }
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [boardId, nodes, enabled, noteSync, retry]);

  return { error, retry: () => setRetry((value) => value + 1) };
}
