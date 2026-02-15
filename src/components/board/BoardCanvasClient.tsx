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
import { LabeledEdge } from './edges/LabeledEdge';
import { BoardToolbar } from './BoardToolbar';
import { AddWebsiteDialog } from './AddWebsiteDialog';
import { useBoardAutoSave } from './hooks/useBoardAutoSave';
import type { Board } from '../../types';

interface BoardCanvasClientProps {
  board: Board;
}

const nodeTypes: NodeTypes = {
  note: NoteNode,
  website: WebsiteNode,
  aiChat: AIChatNode,
};

const edgeTypes: EdgeTypes = {
  labeled: LabeledEdge,
};

function hydrateNodes(board: Board): Node[] {
  return board.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: n.data as unknown as Record<string, unknown>,
    width: n.width,
    height: n.height,
  }));
}

function hydrateEdges(board: Board): Edge[] {
  return board.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: 'labeled' as const,
    data: { label: e.label, style: e.style } as Record<string, unknown>,
  }));
}

function BoardCanvas({ board }: BoardCanvasClientProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(hydrateNodes(board));
  const [edges, setEdges, onEdgesChange] = useEdgesState(hydrateEdges(board));
  const [showWebsiteDialog, setShowWebsiteDialog] = useState(false);
  const { debouncedSave, saveStatus } = useBoardAutoSave(board.id);
  const { screenToFlowPosition } = useReactFlow();

  const [initialId] = useState(() => Date.now());
  const nodeIdCounter = useRef(initialId);

  const nextId = useCallback((prefix: string) => {
    const id = `${prefix}-${nodeIdCounter.current}`;
    nodeIdCounter.current += 1;
    return id;
  }, []);

  // Auto-save whenever nodes or edges change
  useEffect(() => {
    debouncedSave(nodes, edges);
  }, [nodes, edges, debouncedSave]);

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
      data: { text: '', color: 'yellow' },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [nextId, getViewportCenter, setNodes]);

  const addWebsiteNode = useCallback(
    (data: { url: string; title: string; excerpt: string; favicon?: string }) => {
      const position = getViewportCenter();
      const newNode: Node = {
        id: nextId('web'),
        type: 'website',
        position,
        data,
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [nextId, getViewportCenter, setNodes]
  );

  const addAIChatNode = useCallback(() => {
    const position = getViewportCenter();
    const newNode: Node = {
      id: nextId('chat'),
      type: 'aiChat',
      position,
      data: { messages: [], contextLabel: '' },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [nextId, getViewportCenter, setNodes]);

  const defaultEdgeOptions = useMemo(() => ({ type: 'labeled' }), []);

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        deleteKeyCode={['Backspace', 'Delete']}
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
            return '#6b7280';
          }}
          className="!bg-gray-900 !border-gray-700"
          maskColor="rgba(0,0,0,0.6)"
        />
      </ReactFlow>

      <BoardToolbar
        onAddNote={addNoteNode}
        onAddWebsite={() => setShowWebsiteDialog(true)}
        onAddAIChat={addAIChatNode}
        saveStatus={saveStatus}
      />

      <AddWebsiteDialog
        open={showWebsiteDialog}
        onClose={() => setShowWebsiteDialog(false)}
        onAdd={addWebsiteNode}
      />
    </div>
  );
}

export function BoardCanvasClient({ board }: BoardCanvasClientProps) {
  return (
    <ReactFlowProvider>
      <BoardCanvas board={board} />
    </ReactFlowProvider>
  );
}
