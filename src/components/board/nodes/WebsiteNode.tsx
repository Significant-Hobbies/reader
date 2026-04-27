'use client';

import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { ExternalLink } from 'lucide-react';
import { memo } from 'react';

type WebsiteData = {
  url: string;
  title: string;
  excerpt: string;
  favicon?: string;
  articleId?: string;
  readOnly?: boolean;
  onBrowseContent?: (articleId: string, websiteNodeId: string) => void;
  onOpenInBoard?: (articleId: string, url: string, title: string, websiteNodeId: string) => void;
};

function WebsiteNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as WebsiteData;

  const hostname = (() => {
    try {
      return new URL(nodeData.url).hostname;
    } catch {
      return nodeData.url;
    }
  })();

  return (
    <div
      className={`w-[280px] rounded-xl border bg-gray-900/95 shadow-lg transition-shadow ${
        selected
          ? 'border-blue-500 ring-2 ring-blue-500/30'
          : 'border-gray-700 hover:border-gray-600'
      }`}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-gray-500" />

      <div className="border-b border-gray-800 px-3 py-2">
        <div className="flex items-center gap-2">
          {nodeData.favicon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={nodeData.favicon}
              alt=""
              className="h-4 w-4 rounded-sm"
              referrerPolicy="no-referrer"
            />
          ) : (
            <Globe className="h-4 w-4 text-gray-500" />
          )}
          <span className="truncate text-xs text-gray-500">{hostname}</span>
          <a
            href={nodeData.url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-gray-500 hover:text-blue-400"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <div className="px-3 py-2.5">
        <h4 className="mb-1 line-clamp-2 text-sm font-semibold text-gray-100">
          {nodeData.title || 'Untitled'}
        </h4>
        {nodeData.excerpt && (
          <p className="line-clamp-3 text-xs leading-relaxed text-gray-400">{nodeData.excerpt}</p>
        )}
      </div>

      {nodeData.articleId && !nodeData.readOnly && (
        <div className="flex items-center gap-2 border-t border-gray-800 px-3 py-1.5">
          <a
            href={`/reader/${nodeData.articleId}`}
            className="text-xs text-blue-400 hover:text-blue-300"
            onClick={(e) => e.stopPropagation()}
          >
            Open in Reader
          </a>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onOpenInBoard?.(nodeData.articleId!, nodeData.url, nodeData.title, id);
            }}
            className="ml-auto text-xs text-gray-500 transition-colors hover:text-blue-400"
          >
            Open in Board
          </button>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-gray-500" />
    </div>
  );
}

function Globe({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

export const WebsiteNode = memo(WebsiteNodeComponent);
