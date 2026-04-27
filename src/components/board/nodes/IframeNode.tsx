'use client';

import type { NodeProps } from '@xyflow/react';
import { Handle, NodeResizer, Position } from '@xyflow/react';
import { AlertTriangle, ExternalLink, Globe } from 'lucide-react';
import { memo, useMemo, useState } from 'react';

type IframeData = {
  url: string;
  title?: string;
};

function IframeNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as unknown as IframeData;
  const [loadError, setLoadError] = useState(false);

  const hostname = useMemo(() => {
    try {
      return new URL(nodeData.url).hostname;
    } catch {
      return nodeData.url;
    }
  }, [nodeData.url]);

  // Route through server-side proxy to strip X-Frame-Options / CSP headers
  const proxiedUrl = `/api/proxy?url=${encodeURIComponent(nodeData.url)}`;

  return (
    <div
      className={`flex min-w-[16rem] flex-col overflow-hidden rounded-xl border bg-gray-900/95 shadow-lg ${
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
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-gray-500" />

      <div className="flex shrink-0 items-center gap-2 border-b border-gray-800 px-3 py-1.5">
        <Globe className="h-3.5 w-3.5 text-gray-500" />
        <span className="flex-1 truncate text-xs text-gray-400">{nodeData.title || hostname}</span>
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

      <div className="relative flex-1 overflow-hidden">
        {loadError ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
            <AlertTriangle className="h-6 w-6 text-yellow-500" />
            <p className="text-xs text-gray-400">Failed to load this site.</p>
            <a
              href={nodeData.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 underline hover:text-blue-300"
              onClick={(e) => e.stopPropagation()}
            >
              Open in new tab
            </a>
          </div>
        ) : (
          <iframe
            src={proxiedUrl}
            title={nodeData.title || hostname}
            className="h-full w-full border-0 bg-white"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            loading="lazy"
            onError={() => setLoadError(true)}
          />
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-gray-500" />
    </div>
  );
}

export const IframeNode = memo(IframeNodeComponent);
