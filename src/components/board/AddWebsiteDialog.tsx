'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';

interface AddWebsiteDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (data: { url: string; title: string; excerpt: string; favicon?: string }) => void;
}

export function AddWebsiteDialog({ open, onClose, onAdd }: AddWebsiteDialogProps) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/snapshot?url=${encodeURIComponent(trimmedUrl)}`);
      if (!response.ok) throw new Error('Failed to fetch website');

      const { snapshot } = await response.json();

      // Extract excerpt from content (strip HTML via regex to avoid innerHTML XSS)
      const plainText = (snapshot.content || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const excerpt = plainText.slice(0, 300).trim();

      // Try to get favicon
      let favicon: string | undefined;
      try {
        const urlObj = new URL(trimmedUrl);
        favicon = `${urlObj.origin}/favicon.ico`;
      } catch {
        // ignore
      }

      onAdd({
        url: trimmedUrl,
        title: snapshot.title || trimmedUrl,
        excerpt,
        favicon,
      });

      setUrl('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch website');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Add Website</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article"
            autoFocus
            className="mb-3 h-10 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-gray-400 hover:bg-gray-800 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!url.trim() || loading}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Add
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
