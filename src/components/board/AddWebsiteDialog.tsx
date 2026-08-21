'use client';

import { Loader2, X } from 'lucide-react';
import { useRef, useState } from 'react';

interface AddWebsiteDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (data: {
    url: string;
    title: string;
    excerpt: string;
    favicon?: string;
    articleId?: string;
  }) => void;
  onAddIframe: (data: { url: string; title?: string }) => void;
  onAddReader: (data: { articleId: string; url: string; title: string }) => void;
}

const MODE_BUTTONS: { mode: 'card' | 'iframe' | 'pdf'; label: string; sublabel: string }[] = [
  { mode: 'card', label: 'Import Site', sublabel: 'Readable source' },
  { mode: 'iframe', label: 'Embed Site', sublabel: 'Live preview' },
  { mode: 'pdf', label: 'PDF/Paper', sublabel: 'Original PDF' },
];

function ModeSelector({
  mode,
  onSelect,
}: {
  mode: 'card' | 'iframe' | 'pdf';
  onSelect: (m: 'card' | 'iframe' | 'pdf') => void;
}) {
  return (
    <div className="mb-3 grid grid-cols-3 gap-2">
      {MODE_BUTTONS.map((btn) => (
        <button
          key={btn.mode}
          type="button"
          onClick={() => onSelect(btn.mode)}
          className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
            mode === btn.mode
              ? 'bg-blue-600 text-white'
              : 'border border-gray-700 text-gray-400 hover:text-gray-200'
          }`}
        >
          {btn.label}
          <span className="mt-0.5 block text-[10px] opacity-70">{btn.sublabel}</span>
        </button>
      ))}
    </div>
  );
}

async function uploadPdf(
  file: File,
  onAddReader: (data: { articleId: string; url: string; title: string }) => void
): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', 'Paper');

  const response = await fetch('/api/pdf/upload', { method: 'POST', body: formData });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to import PDF');
  }

  const data = (await response.json()) as { id: string; title?: string; pdfUrl?: string };
  onAddReader({
    articleId: data.id,
    url: data.pdfUrl || `pdf://${file.name}`,
    title: data.title || file.name.replace(/\.pdf$/i, ''),
  });
}

async function fetchWebsiteCard(
  rawUrl: string,
  onAdd: (data: {
    url: string;
    title: string;
    excerpt: string;
    favicon?: string;
    articleId?: string;
  }) => void
): Promise<void> {
  const response = await fetch(`/api/snapshot?url=${encodeURIComponent(rawUrl)}`);
  if (!response.ok) throw new Error('Failed to fetch website');

  const { snapshot } = await response.json();
  const plainText = (snapshot.content || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const excerpt = plainText.slice(0, 300).trim();

  let favicon: string | undefined;
  try {
    favicon = `${new URL(rawUrl).origin}/favicon.ico`;
  } catch {
    // ignore
  }

  let articleId: string | undefined;
  try {
    const articleRes = await fetch('/api/articles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: rawUrl,
        title: snapshot.title || rawUrl,
        byline: snapshot.byline,
        content: snapshot.content || '',
      }),
    });
    if (articleRes.ok) articleId = (await articleRes.json()).id;
  } catch {
    // Article creation failed — still add the card without articleId
  }

  onAdd({ url: rawUrl, title: snapshot.title || rawUrl, excerpt, favicon, articleId });
}

export function AddWebsiteDialog({
  open,
  onClose,
  onAdd,
  onAddIframe,
  onAddReader,
}: AddWebsiteDialogProps) {
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState<'card' | 'iframe' | 'pdf'>('card');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const resetAndClose = () => {
    setUrl('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (mode === 'pdf') {
      if (!selectedFile) return;
      setLoading(true);
      try {
        await uploadPdf(selectedFile, onAddReader);
        resetAndClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to import PDF');
      } finally {
        setLoading(false);
      }
      return;
    }

    let trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    if (!/^https?:\/\//i.test(trimmedUrl)) trimmedUrl = `https://${trimmedUrl}`;

    if (mode === 'iframe') {
      onAddIframe({ url: trimmedUrl });
      resetAndClose();
      return;
    }

    setLoading(true);
    try {
      await fetchWebsiteCard(trimmedUrl, onAdd);
      resetAndClose();
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
          <h3 className="text-lg font-semibold text-white">Add Source</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)}>
          {mode !== 'pdf' ? (
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              autoFocus
              className="mb-3 h-10 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 text-sm text-gray-100 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          ) : (
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                setError(null);
                setSelectedFile(e.target.files?.[0] ?? null);
              }}
              className="mb-3 h-10 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 file:mr-3 file:rounded-md file:border-0 file:bg-gray-800 file:px-3 file:py-1 file:text-xs file:text-gray-200"
            />
          )}

          <ModeSelector mode={mode} onSelect={setMode} />

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
              disabled={(mode === 'pdf' ? !selectedFile : !url.trim()) || loading}
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
