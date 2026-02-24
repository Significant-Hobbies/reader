'use client';

import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  type Connection,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { NoteNode } from './nodes/NoteNode';
import { WebsiteNode } from './nodes/WebsiteNode';
import { AIChatNode } from './nodes/AIChatNode';
import { IframeNode } from './nodes/IframeNode';
import { ReaderNode } from './nodes/ReaderNode';
import { LabeledEdge } from './edges/LabeledEdge';
import { BoardToolbar } from './BoardToolbar';
import { AddWebsiteDialog } from './AddWebsiteDialog';
import { ElementPickerPanel } from './ElementPickerPanel';
import { useBoardAutoSave } from './hooks/useBoardAutoSave';
import { useBoardArticleSync } from './hooks/useBoardArticleSync';
import type { Board, ElementAnchor, AIChatMessage } from '../../types';

interface BoardCanvasClientProps {
  board: Board;
  readOnly?: boolean;
}

const nodeTypes: NodeTypes = {
  note: NoteNode,
  website: WebsiteNode,
  aiChat: AIChatNode,
  iframe: IframeNode,
  reader: ReaderNode,
};

const edgeTypes: EdgeTypes = {
  labeled: LabeledEdge,
};

function hydrateNodes(board: Board, readOnly?: boolean): Node[] {
  return board.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: {
      ...(n.data as unknown as Record<string, unknown>),
      ...(readOnly ? { readOnly: true } : {}),
    },
    width: n.width,
    height: n.height,
  }));
}

function hydrateEdges(board: Board, readOnly?: boolean): Edge[] {
  return board.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: 'labeled' as const,
    data: { label: e.label, style: e.style, ...(readOnly ? { readOnly: true } : {}) } as Record<
      string,
      unknown
    >,
  }));
}

function useSuppressBrowserZoom() {
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')
      ) {
        e.preventDefault();
      }
    };
    const onGesture = (e: Event) => {
      e.preventDefault();
    };

    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
    const existingMeta = document.querySelector('meta[name="viewport"]');
    const previousContent = existingMeta?.getAttribute('content') ?? null;
    if (existingMeta) {
      existingMeta.setAttribute('content', meta.content);
    } else {
      document.head.appendChild(meta);
    }

    document.addEventListener('wheel', onWheel, { passive: false, capture: true });
    document.addEventListener('keydown', onKeyDown, { capture: true });
    document.addEventListener('gesturestart', onGesture, { capture: true });
    document.addEventListener('gesturechange', onGesture, { capture: true });

    return () => {
      document.removeEventListener('wheel', onWheel, { capture: true });
      document.removeEventListener('keydown', onKeyDown, { capture: true });
      document.removeEventListener('gesturestart', onGesture, { capture: true });
      document.removeEventListener('gesturechange', onGesture, { capture: true });
      if (previousContent !== null && existingMeta) {
        existingMeta.setAttribute('content', previousContent);
      } else if (!existingMeta) {
        meta.remove();
      }
    };
  }, []);
}

function BoardCanvas({ board, readOnly }: BoardCanvasClientProps) {
  useSuppressBrowserZoom();
  const [nodes, setNodes, onNodesChange] = useNodesState(hydrateNodes(board, readOnly));
  const [edges, setEdges, onEdgesChange] = useEdgesState(hydrateEdges(board, readOnly));
  const [showWebsiteDialog, setShowWebsiteDialog] = useState(false);
  const [boardName, setBoardName] = useState(board.name);
  const { debouncedSave, saveStatus } = useBoardAutoSave(board.id);
  const { screenToFlowPosition, getNodes } = useReactFlow();

  const [pickerState, setPickerState] = useState<{
    articleId: string;
    websiteNodeId: string;
  } | null>(null);

  const openElementPicker = useCallback((articleId: string, websiteNodeId: string) => {
    setPickerState({ articleId, websiteNodeId });
  }, []);

  const saveBoardName = useCallback(
    async (name: string) => {
      const trimmed = name.trim() || 'Untitled Board';
      setBoardName(trimmed);
      try {
        await fetch(`/api/boards/${board.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmed }),
        });
      } catch {
        // silent fail for name save
      }
    },
    [board.id]
  );

  const [initialId] = useState(() => Date.now());
  const nodeIdCounter = useRef(initialId);

  const nextId = useCallback((prefix: string) => {
    const id = `${prefix}-${nodeIdCounter.current}`;
    nodeIdCounter.current += 1;
    return id;
  }, []);

  // Auto-save whenever nodes or edges change
  useEffect(() => {
    if (!readOnly) debouncedSave(nodes, edges);
  }, [nodes, edges, debouncedSave, readOnly]);

  // Sync linked note/chat nodes back to their articles
  useBoardArticleSync(readOnly ? [] : nodes);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) =>
        addEdge({ ...connection, type: 'labeled', data: { label: '', style: 'solid' } }, eds)
      );
    },
    [setEdges]
  );

  const getViewportCenter = useCallback(() => {
    const offset = () => Math.random() * 60 - 30;
    return screenToFlowPosition({
      x: window.innerWidth / 2 + offset(),
      y: window.innerHeight / 2 + offset(),
    });
  }, [screenToFlowPosition]);

  const addNoteNode = useCallback(() => {
    const position = getViewportCenter();
    const newNode: Node = {
      id: nextId('note'),
      type: 'note',
      position,
      data: { text: '', color: 'yellow', onBrowseContent: openElementPicker },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [nextId, getViewportCenter, setNodes, openElementPicker]);

  const addWebsiteNode = useCallback(
    (data: {
      url: string;
      title: string;
      excerpt: string;
      favicon?: string;
      articleId?: string;
    }) => {
      const position = getViewportCenter();
      const newNode: Node = {
        id: nextId('web'),
        type: 'website',
        position,
        data: { ...data, onBrowseContent: openElementPicker },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [nextId, getViewportCenter, setNodes, openElementPicker]
  );

  const addAIChatNode = useCallback(() => {
    const position = getViewportCenter();
    const newNode: Node = {
      id: nextId('chat'),
      type: 'aiChat',
      position,
      data: { messages: [], contextLabel: '', onBrowseContent: openElementPicker },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [nextId, getViewportCenter, setNodes, openElementPicker]);

  const addIframeNode = useCallback(
    (data: { url: string; title?: string }) => {
      const position = getViewportCenter();
      const newNode: Node = {
        id: nextId('iframe'),
        type: 'iframe',
        position,
        data,
        width: 500,
        height: 400,
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [nextId, getViewportCenter, setNodes]
  );

  const handleReaderSpawnNote = useCallback(
    (anchor: ElementAnchor, elementText: string) => {
      const readerNode = getNodes().find((n) => n.id === anchor.websiteNodeId);
      const position = readerNode
        ? {
            x: readerNode.position.x + (readerNode.measured?.width ?? 700) + 40,
            y: readerNode.position.y,
          }
        : getViewportCenter();

      const newNode: Node = {
        id: nextId('note'),
        type: 'note',
        position,
        data: {
          text: elementText,
          color: 'blue',
          elementAnchor: anchor,
          onBrowseContent: openElementPicker,
        },
      };
      setNodes((nds) => [...nds, newNode]);
      setEdges((eds) => [
        ...eds,
        {
          id: `link-${newNode.id}-${anchor.websiteNodeId}`,
          source: anchor.websiteNodeId,
          target: newNode.id,
          type: 'labeled',
          data: { label: anchor.tagName || 'element', style: 'dashed' },
        },
      ]);
    },
    [getNodes, getViewportCenter, nextId, setNodes, setEdges, openElementPicker]
  );

  const handleReaderSpawnAIChat = useCallback(
    (anchor: ElementAnchor, elementText: string) => {
      const readerNode = getNodes().find((n) => n.id === anchor.websiteNodeId);
      const position = readerNode
        ? {
            x: readerNode.position.x + (readerNode.measured?.width ?? 700) + 40,
            y: readerNode.position.y + 100,
          }
        : getViewportCenter();

      const contextMessage: AIChatMessage = {
        role: 'user',
        content: `Explain this element from the article:\n\n"${elementText}"`,
        elementAnchor: anchor,
      };

      const newNode: Node = {
        id: nextId('chat'),
        type: 'aiChat',
        position,
        data: {
          messages: [contextMessage],
          contextLabel: `Re: ${anchor.tagName || 'element'} — "${(anchor.textPreview || '').slice(0, 60)}"`,
          elementAnchor: anchor,
          onBrowseContent: openElementPicker,
        },
      };
      setNodes((nds) => [...nds, newNode]);
      setEdges((eds) => [
        ...eds,
        {
          id: `link-${newNode.id}-${anchor.websiteNodeId}`,
          source: anchor.websiteNodeId,
          target: newNode.id,
          type: 'labeled',
          data: { label: anchor.tagName || 'element', style: 'dashed' },
        },
      ]);
    },
    [getNodes, getViewportCenter, nextId, setNodes, setEdges, openElementPicker]
  );

  const addReaderNode = useCallback(
    (articleId: string, url: string, title: string, nearNodeId?: string) => {
      const nearNode = nearNodeId ? getNodes().find((n) => n.id === nearNodeId) : undefined;
      const position = nearNode
        ? {
            x: nearNode.position.x + (nearNode.measured?.width ?? 280) + 60,
            y: nearNode.position.y,
          }
        : getViewportCenter();

      const newNode: Node = {
        id: nextId('reader'),
        type: 'reader',
        position,
        data: {
          articleId,
          url,
          title,
          onSpawnNote: handleReaderSpawnNote,
          onSpawnAIChat: handleReaderSpawnAIChat,
        },
        width: 700,
        height: 500,
      };
      setNodes((nds) => [...nds, newNode]);

      if (nearNodeId) {
        setEdges((eds) => [
          ...eds,
          {
            id: `link-${newNode.id}-${nearNodeId}`,
            source: nearNodeId,
            target: newNode.id,
            type: 'labeled',
            data: { label: '', style: 'solid' },
          },
        ]);
      }
    },
    [
      nextId,
      getViewportCenter,
      getNodes,
      setNodes,
      setEdges,
      handleReaderSpawnNote,
      handleReaderSpawnAIChat,
    ]
  );

  const handlePickerAddNote = useCallback(
    (anchor: ElementAnchor, elementText: string) => {
      const websiteNode = getNodes().find((n) => n.id === anchor.websiteNodeId);
      const position = websiteNode
        ? {
            x: websiteNode.position.x + (websiteNode.measured?.width ?? 250) + 40,
            y: websiteNode.position.y,
          }
        : getViewportCenter();

      const newNode: Node = {
        id: nextId('note'),
        type: 'note',
        position,
        data: {
          text: elementText,
          color: 'blue',
          elementAnchor: anchor,
          onBrowseContent: openElementPicker,
        },
      };
      setNodes((nds) => [...nds, newNode]);

      setEdges((eds) => [
        ...eds,
        {
          id: `link-${newNode.id}-${anchor.websiteNodeId}`,
          source: anchor.websiteNodeId,
          target: newNode.id,
          type: 'labeled',
          data: {
            label: anchor.tagName || 'element',
            style: 'dashed',
          },
        },
      ]);

      setPickerState(null);
    },
    [getNodes, getViewportCenter, nextId, setNodes, setEdges, openElementPicker]
  );

  const handlePickerAskAI = useCallback(
    (anchor: ElementAnchor, elementText: string) => {
      const websiteNode = getNodes().find((n) => n.id === anchor.websiteNodeId);
      const position = websiteNode
        ? {
            x: websiteNode.position.x + (websiteNode.measured?.width ?? 250) + 40,
            y: websiteNode.position.y + 100,
          }
        : getViewportCenter();

      const contextMessage: AIChatMessage = {
        role: 'user',
        content: `Explain this element from the article:\n\n"${elementText}"`,
        elementAnchor: anchor,
      };

      const newNode: Node = {
        id: nextId('chat'),
        type: 'aiChat',
        position,
        data: {
          messages: [contextMessage],
          contextLabel: `Re: ${anchor.tagName || 'element'} — "${(anchor.textPreview || '').slice(0, 60)}"`,
          elementAnchor: anchor,
          onBrowseContent: openElementPicker,
        },
      };
      setNodes((nds) => [...nds, newNode]);

      setEdges((eds) => [
        ...eds,
        {
          id: `link-${newNode.id}-${anchor.websiteNodeId}`,
          source: anchor.websiteNodeId,
          target: newNode.id,
          type: 'labeled',
          data: {
            label: anchor.tagName || 'element',
            style: 'dashed',
          },
        },
      ]);

      setPickerState(null);
    },
    [getNodes, getViewportCenter, nextId, setNodes, setEdges, openElementPicker]
  );

  // Inject callbacks into all nodes that support them
  useEffect(() => {
    if (readOnly) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.type === 'website') {
          return {
            ...n,
            data: {
              ...n.data,
              onBrowseContent: openElementPicker,
              onOpenInBoard: addReaderNode,
            },
          };
        }
        if (n.type === 'note' || n.type === 'aiChat') {
          return { ...n, data: { ...n.data, onBrowseContent: openElementPicker } };
        }
        if (n.type === 'reader') {
          return {
            ...n,
            data: {
              ...n.data,
              onSpawnNote: handleReaderSpawnNote,
              onSpawnAIChat: handleReaderSpawnAIChat,
            },
          };
        }
        return n;
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openElementPicker, addReaderNode, handleReaderSpawnNote, handleReaderSpawnAIChat, readOnly]);

  const defaultEdgeOptions = useMemo(() => ({ type: 'labeled' }), []);

  return (
    <div className="relative h-full w-full" style={{ touchAction: 'none' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={readOnly ? undefined : onNodesChange}
        onEdgesChange={readOnly ? undefined : onEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        deleteKeyCode={readOnly ? null : ['Backspace', 'Delete']}
        className="board-canvas"
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#374151" />
        <Controls
          showInteractive={false}
          className="!bg-gray-900 !border-gray-700 !shadow-lg [&>button]:!bg-gray-900 [&>button]:!border-gray-700 [&>button]:!text-gray-400 [&>button:hover]:!bg-gray-800"
        />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'note') return '#fde047';
            if (node.type === 'website') return '#60a5fa';
            if (node.type === 'aiChat') return '#a78bfa';
            if (node.type === 'iframe') return '#34d399';
            return '#6b7280';
          }}
          className="!bg-gray-900 !border-gray-700"
          maskColor="rgba(0,0,0,0.6)"
        />
      </ReactFlow>

      {readOnly ? (
        <div className="absolute left-4 top-4 z-10 rounded-lg border border-gray-700 bg-gray-900/90 px-3 py-1.5 shadow-lg backdrop-blur">
          <span className="text-sm font-semibold text-white">{boardName}</span>
          <span className="ml-2 text-xs text-gray-500">Read-only</span>
        </div>
      ) : (
        <>
          <BoardToolbar
            boardName={boardName}
            onBoardNameChange={saveBoardName}
            onAddNote={addNoteNode}
            onAddWebsite={() => setShowWebsiteDialog(true)}
            onAddAIChat={addAIChatNode}
            saveStatus={saveStatus}
            boardId={board.id}
            shareId={board.shareId}
          />

          <AddWebsiteDialog
            open={showWebsiteDialog}
            onClose={() => setShowWebsiteDialog(false)}
            onAdd={addWebsiteNode}
            onAddIframe={addIframeNode}
          />

          {pickerState && (
            <ElementPickerPanel
              articleId={pickerState.articleId}
              websiteNodeId={pickerState.websiteNodeId}
              onClose={() => setPickerState(null)}
              onAddNote={handlePickerAddNote}
              onAskAI={handlePickerAskAI}
            />
          )}
        </>
      )}
    </div>
  );
}

export function BoardCanvasClient({ board, readOnly }: BoardCanvasClientProps) {
  return (
    <ReactFlowProvider>
      <BoardCanvas board={board} readOnly={readOnly} />
    </ReactFlowProvider>
  );
}
