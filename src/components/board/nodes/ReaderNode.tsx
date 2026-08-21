'use client';

import { useQuery } from '@tanstack/react-query';
import type { NodeProps } from '@xyflow/react';
import { Handle, NodeResizeControl, Position } from '@xyflow/react';
import { GripVertical } from 'lucide-react';
import { memo, useCallback } from 'react';

import type { Article, ElementAnchor, ReaderSettings } from '../../../types';
import { PDFViewer } from '../../PDFViewer';
import { ReaderCore } from '../../reader/ReaderCore';

type ReaderData = {
  articleId: string;
  url: string;
  title: string;
  readOnly?: boolean;
  onSpawnNote?: (anchor: ElementAnchor, text: string) => void;
  onSpawnAIChat?: (anchor: ElementAnchor, text: string) => void;
};

const compactPdfSettings: ReaderSettings = {
  fontSize: 'medium',
  theme: 'dark',
  fontFamily: 'sans',
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
      className={`overflow-hidden rounded-xl border bg-gray-900/95 shadow-lg ${
        selected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-gray-700'
      }`}
      style={{ width: '100%', height: '100%', minWidth: 400, minHeight: 300 }}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-gray-500" />

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
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-500" />
          </div>
        )}
        {error && !article && (
          <div className="flex h-full items-center justify-center text-sm text-gray-500">
            Failed to load article
          </div>
        )}
        {article?.type === 'pdf' && article.pdfUrl && (
          <div className="nodrag nowheel h-full">
            <div className="border-b border-gray-800 bg-gray-950/95 px-4 py-3">
              <p className="truncate text-sm font-semibold text-white" title={article.title}>
                {article.title || 'PDF'}
              </p>
              {article.pdfMetadata?.pageCount && (
                <p className="mt-0.5 text-xs text-gray-500">
                  {article.pdfMetadata.pageCount} pages
                </p>
              )}
            </div>
            <div className="h-[calc(100%-57px)]">
              <PDFViewer pdfUrl={article.pdfUrl} settings={compactPdfSettings} />
            </div>
          </div>
        )}
        {article && article.type !== 'pdf' && (
          <div className="nodrag nowheel h-full">
            <ReaderCore
              article={article}
              readOnly={nodeData.readOnly}
              compact
              handlers={{
                onSpawnNote: nodeData.readOnly ? undefined : handleSpawnNote,
                onSpawnAIChat: nodeData.readOnly ? undefined : handleSpawnAIChat,
              }}
            />
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-gray-500" />
    </div>
  );
}

export const ReaderNode = memo(ReaderNodeComponent);
