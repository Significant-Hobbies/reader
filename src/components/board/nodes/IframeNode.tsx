'use client';

import { memo } from 'react';
import { Handle, Position, NodeProps, NodeResizer } from '@xyflow/react';
import { ExternalLink, Globe } from 'lucide-react';

type IframeData = {
  url: string;
  title?: string;
};

function IframeNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as IframeData;

  const hostname = (() => {
    try {
      return new URL(nodeData.url).hostname;
    } catch {
      return nodeData.url;
    }
  })();

  return (
    <div
      className={`flex min-w-[16rem] flex-col rounded-xl border bg-gray-900/95 shadow-lg overflow-hidden ${
        selected
          ? 'border-blue-500 ring-2 ring-blue-500/30'
          : 'border-gray-700 hover:border-gray-600'
      }`}
      style={{ width: '100%', height: '100%', minHeight: 200 }}
    >
      <NodeResizer
        isVisible={!!selected}
        minWidth={260}
        minHeight={200}
        lineClassName="!border-blue-500"
        handleClassName="!w-2 !h-2 !bg-blue-500 !border-blue-500"
      />
      <Handle type="target" position={Position.Top} className="!bg-gray-500 !w-2 !h-2" />

      <div className="flex items-center gap-2 border-b border-gray-800 px-3 py-1.5 shrink-0">
        <Globe className="h-3.5 w-3.5 text-gray-500" />
        <span className="truncate text-xs text-gray-400 flex-1">{nodeData.title || hostname}</span>
        <a
          href={nodeData.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-500 hover:text-blue-400"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="flex-1 overflow-hidden">
        <iframe
          src={nodeData.url}
          title={nodeData.title || hostname}
          className="w-full h-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          loading="lazy"
        />
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-gray-500 !w-2 !h-2" />
    </div>
  );
}

export const IframeNode = memo(IframeNodeComponent);
