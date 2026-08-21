'use client';

import { Check, Copy, Link2, Trash2, X } from 'lucide-react';
import { useCallback, useState } from 'react';

interface ShareLinkConfig {
  apiPath: string;
  sharePathPrefix: string;
  entityLabel: string;
}

interface ShareLinkDialogProps {
  open: boolean;
  onClose: () => void;
  config: ShareLinkConfig;
  shareId?: string;
  onShareIdChange: (shareId: string | undefined) => void;
}

function buildShareUrl(shareId: string | undefined, prefix: string): string {
  if (!shareId) return '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/share/${prefix}${shareId}`;
}

export function ShareLinkDialog({
  open,
  onClose,
  config,
  shareId,
  onShareIdChange,
}: ShareLinkDialogProps) {
  const { apiPath, sharePathPrefix, entityLabel } = config;
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = buildShareUrl(shareId, sharePathPrefix);

  const sendShareAction = useCallback(
    async (action: 'generate' | 'revoke') => {
      setLoading(true);
      try {
        const res = await fetch(apiPath, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shareAction: action }),
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        onShareIdChange(action === 'generate' ? data.shareId : undefined);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    },
    [apiPath, onShareIdChange]
  );

  const copyUrl = useCallback(() => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [shareUrl]);

  if (!open) return null;

  const lowerLabel = entityLabel.toLowerCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-gray-700 bg-gray-900 p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Share {entityLabel}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {shareId ? (
          <ActiveShareSection
            shareUrl={shareUrl}
            copied={copied}
            loading={loading}
            lowerLabel={lowerLabel}
            onCopy={copyUrl}
            onRevoke={() => sendShareAction('revoke')}
          />
        ) : (
          <GenerateShareSection
            loading={loading}
            lowerLabel={lowerLabel}
            onGenerate={() => sendShareAction('generate')}
          />
        )}
      </div>
    </div>
  );
}

function ActiveShareSection({
  shareUrl,
  copied,
  loading,
  lowerLabel,
  onCopy,
  onRevoke,
}: {
  shareUrl: string;
  copied: boolean;
  loading: boolean;
  lowerLabel: string;
  onCopy: () => void;
  onRevoke: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">
        Anyone with this link can view this {lowerLabel} (read-only).
      </p>
      <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2">
        <Link2 className="h-3.5 w-3.5 shrink-0 text-gray-500" />
        <span className="flex-1 truncate text-xs text-gray-300">{shareUrl}</span>
        <button
          onClick={onCopy}
          className="shrink-0 text-gray-400 hover:text-white"
          title="Copy link"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <button
        onClick={onRevoke}
        disabled={loading}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
      >
        <Trash2 className="h-3 w-3" />
        Revoke Link
      </button>
    </div>
  );
}

function GenerateShareSection({
  loading,
  lowerLabel,
  onGenerate,
}: {
  loading: boolean;
  lowerLabel: string;
  onGenerate: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">
        Generate a public link so anyone can view this {lowerLabel} without logging in.
      </p>
      <button
        onClick={onGenerate}
        disabled={loading}
        className="flex w-full items-center justify-center gap-1.5 bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
      >
        <Link2 className="h-3.5 w-3.5" />
        {loading ? 'Generating...' : 'Generate Share Link'}
      </button>
    </div>
  );
}
