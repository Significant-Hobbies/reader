import { useEffect, useRef, useCallback } from 'react';
import type { Node } from '@xyflow/react';
import type { Note, AIChatMessage, NoteAnchor } from '../../../types';

const SYNC_DEBOUNCE_MS = 2000;

interface SyncableNoteData {
  text: string;
  elementAnchor?: {
    articleId: string;
    websiteNodeId: string;
    elementIndex: number;
    tagName?: string;
    textPreview?: string;
  };
}

interface SyncableChatData {
  messages: AIChatMessage[];
  elementAnchor?: {
    articleId: string;
    websiteNodeId: string;
    elementIndex: number;
    tagName?: string;
    textPreview?: string;
  };
}

export function useBoardArticleSync(nodes: Node[]) {
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastSyncedRef = useRef<Map<string, string>>(new Map());
  const isMountedRef = useRef(false);

  const syncArticle = useCallback(
    async (articleId: string, notes: Note[], aiChat: AIChatMessage[]) => {
      const payload: Record<string, unknown> = {};
      if (notes.length > 0) payload.notes = notes;
      if (aiChat.length > 0) payload.aiChat = aiChat;
      if (Object.keys(payload).length === 0) return;

      try {
        await fetch(`/api/articles/${articleId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        console.error('Board article sync failed:', err);
      }
    },
    []
  );

  useEffect(() => {
    // Skip the very first render (initial hydration)
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }

    // Group nodes by articleId
    const articleNotes = new Map<string, Note[]>();
    const articleChats = new Map<string, AIChatMessage[]>();

    for (const node of nodes) {
      if (node.type === 'note') {
        const data = node.data as unknown as SyncableNoteData;
        if (!data.elementAnchor?.articleId) continue;
        const aid = data.elementAnchor.articleId;

        const existing = articleNotes.get(aid) || [];
        const anchor: NoteAnchor = {
          elementIndex: data.elementAnchor.elementIndex,
          tagName: data.elementAnchor.tagName,
          textPreview: data.elementAnchor.textPreview,
        };
        existing.push({
          id: existing.length + 1,
          text: data.text || '',
          anchor,
        });
        articleNotes.set(aid, existing);
      }

      if (node.type === 'aiChat') {
        const data = node.data as unknown as SyncableChatData;
        if (!data.elementAnchor?.articleId) continue;
        const aid = data.elementAnchor.articleId;

        const existing = articleChats.get(aid) || [];
        existing.push(...data.messages);
        articleChats.set(aid, existing);
      }
    }

    // For each article, debounce sync
    const allArticleIds = new Set([...articleNotes.keys(), ...articleChats.keys()]);

    for (const articleId of allArticleIds) {
      const notes = articleNotes.get(articleId) || [];
      const chats = articleChats.get(articleId) || [];
      const serialized = JSON.stringify({ notes, chats });

      if (serialized === lastSyncedRef.current.get(articleId)) continue;

      const existingTimeout = timeoutsRef.current.get(articleId);
      if (existingTimeout) clearTimeout(existingTimeout);

      timeoutsRef.current.set(
        articleId,
        setTimeout(() => {
          lastSyncedRef.current.set(articleId, serialized);
          void syncArticle(articleId, notes, chats);
        }, SYNC_DEBOUNCE_MS)
      );
    }
  }, [nodes, syncArticle]);

  // Cleanup on unmount
  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      for (const timeout of timeouts.values()) {
        clearTimeout(timeout);
      }
    };
  }, []);
}
