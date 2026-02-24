'use client';

import { memo, useCallback } from 'react';
import { Handle, Position, NodeProps, NodeResizeControl } from '@xyflow/react';
import { useQuery } from '@tanstack/react-query';
import { GripVertical } from 'lucide-react';
import { ReaderCore } from '../../reader/ReaderCore';
import type { Article, ElementAnchor } from '../../../types';

type ReaderData = {
  articleId: string;
  url: string;
  title: string;
  readOnly?: boolean;
  onSpawnNote?: (anchor: ElementAnchor, text: string) => void;
  onSpawnAIChat?: (anchor: ElementAnchor, text: string) => void;
};

function ReaderNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as ReaderData;

  const {
    data: article,
    isLoading,
    error,
  } = useQuery<Article>({
    queryKey: ['article', nodeData.articleId],
    queryFn: async () => {
      const res = await fetch(`/api/articles/${nodeData.articleId}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: Boolean(nodeData.articleId),
    staleTime: 30_000,
  });

  const handleSpawnNote = useCallback(
    (anchor: ElementAnchor, text: string) => {
      // Override websiteNodeId with this reader node's id
      nodeData.onSpawnNote?.({ ...anchor, websiteNodeId: id }, text);
    },
    [id, nodeData]
  );

  const handleSpawnAIChat = useCallback(
    (anchor: ElementAnchor, text: string) => {
      nodeData.onSpawnAIChat?.({ ...anchor, websiteNodeId: id }, text);
    },
    [id, nodeData]
  );

  return (
    <div
      className={`rounded-xl border bg-gray-900/95 shadow-lg overflow-hidden ${
        selected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-gray-700'
      }`}
      style={{ width: '100%', height: '100%', minWidth: 400, minHeight: 300 }}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-500 !w-2 !h-2" />

      {!nodeData.readOnly && (
        <NodeResizeControl
          minWidth={400}
          minHeight={300}
          style={{ background: 'transparent', border: 'none' }}
        >
          <GripVertical className="h-3 w-3 text-gray-600" />
        </NodeResizeControl>
      )}

      <div className="h-full w-full overflow-hidden">
        {isLoading && (
          <div className="flex h-full items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        )}
        {error && !article && (
          <div className="flex h-full items-center justify-center text-gray-500 text-sm">
            Failed to load article
          </div>
        )}
        {article && (
          <div className="h-full nodrag nowheel">
            <ReaderCore
              article={article}
              readOnly={nodeData.readOnly}
              compact
              onSpawnNote={nodeData.readOnly ? undefined : handleSpawnNote}
              onSpawnAIChat={nodeData.readOnly ? undefined : handleSpawnAIChat}
            />
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-gray-500 !w-2 !h-2" />
    </div>
  );
}

export const ReaderNode = memo(ReaderNodeComponent);
