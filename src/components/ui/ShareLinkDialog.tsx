'use client';

import { Check, Copy, Link2, Trash2, X } from 'lucide-react';
import { useCallback, useState } from 'react';

interface ShareLinkDialogProps {
  open: boolean;
  onClose: () => void;
  /** API endpoint to PUT with `{ shareAction: 'generate' | 'revoke' }`. */
  apiPath: string;
  /** Path segment appended after `/share/` to build the public URL. */
  sharePathPrefix: string;
  /** Human label, e.g. "Board" or "Article". */
  entityLabel: string;
  shareId?: string;
  onShareIdChange: (shareId: string | undefined) => void;
}

export function ShareLinkDialog({
  open,
  onClose,
  apiPath,
  sharePathPrefix,
  entityLabel,
  shareId,
  onShareIdChange,
}: ShareLinkDialogProps) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = shareId
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${sharePathPrefix}${shareId}`
    : '';

  const generate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiPath, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareAction: 'generate' }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      onShareIdChange(data.shareId);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [apiPath, onShareIdChange]);

  const revoke = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiPath, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shareAction: 'revoke' }),
      });
      if (!res.ok) throw new Error();
      onShareIdChange(undefined);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [apiPath, onShareIdChange]);

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
          <div className="space-y-3">
            <p className="text-xs text-gray-400">
              Anyone with this link can view this {lowerLabel} (read-only).
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-950 px-3 py-2">
              <Link2 className="h-3.5 w-3.5 shrink-0 text-gray-500" />
              <span className="flex-1 truncate text-xs text-gray-300">{shareUrl}</span>
              <button
                onClick={copyUrl}
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
              onClick={revoke}
              disabled={loading}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" />
              Revoke Link
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-400">
              Generate a public link so anyone can view this {lowerLabel} without logging in.
            </p>
            <button
              onClick={generate}
              disabled={loading}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              <Link2 className="h-3.5 w-3.5" />
              {loading ? 'Generating...' : 'Generate Share Link'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
