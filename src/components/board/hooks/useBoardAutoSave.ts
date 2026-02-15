import { useEffect, useRef, useCallback, useState } from 'react';
import type { Node, Edge } from '@xyflow/react';

const SAVE_DEBOUNCE_MS = 1000;

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Deeply clone data through JSON to strip non-serializable values (functions, symbols, etc). */
function cleanNodeData(data: unknown): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(data ?? {})) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function useBoardAutoSave(boardId: string) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDataRef = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const lastSavedRef = useRef<string>('');
  const isMountedRef = useRef(false);

  const save = useCallback(
    async (nodes: Node[], edges: Edge[], keepalive = false) => {
      const payload = {
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: { x: n.position.x, y: n.position.y },
          data: cleanNodeData(n.data),
          width: n.measured?.width ?? n.width,
          height: n.measured?.height ?? n.height,
        })),
        edges: edges.map((e) => {
          const d = (e.data ?? {}) as Record<string, unknown>;
          return {
            id: e.id,
            source: e.source,
            target: e.target,
            label: d.label,
            style: d.style,
          };
        }),
      };

      const serialized = JSON.stringify(payload);
      if (serialized === lastSavedRef.current) return;

      setSaveStatus('saving');
      try {
        const response = await fetch(`/api/boards/${boardId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          keepalive,
          body: serialized,
        });
        if (!response.ok) {
          const errorText = await response.text().catch(() => '');
          console.error(`Board save failed (${response.status}):`, errorText);
          throw new Error('Failed to save');
        }
        lastSavedRef.current = serialized;
        setSaveStatus('saved');
      } catch (err) {
        console.error('Board save error:', err);
        setSaveStatus('error');
      }
    },
    [boardId]
  );

  const debouncedSave = useCallback(
    (nodes: Node[], edges: Edge[]) => {
      latestDataRef.current = { nodes, edges };

      // Skip the very first call (initial mount/hydration)
      if (!isMountedRef.current) {
        isMountedRef.current = true;
        return;
      }

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        void save(nodes, edges);
      }, SAVE_DEBOUNCE_MS);
    },
    [save]
  );

  // Flush on unmount
  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      const data = latestDataRef.current;
      if (data && isMountedRef.current) {
        void save(data.nodes, data.edges, true).catch(() => {});
      }
    },
    [save]
  );

  return { debouncedSave, saveStatus };
}
