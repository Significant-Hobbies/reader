import { useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import type { PageContent, AIChatMessage } from '../lib/types';
import { saveToLibrary, saveChatHistory, getApiBase } from '../lib/api';

interface SaveButtonProps {
  page: PageContent;
  messages: AIChatMessage[];
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function SaveButton({ page, messages }: SaveButtonProps) {
  const [state, setState] = useState<SaveState>('idle');
  const [savedId, setSavedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const openInActiveTab = async (articleId: string) => {
    const url = `${getApiBase()}/reader/${articleId}`;
    const response = await chrome.runtime
      .sendMessage({ type: 'OPEN_URL_IN_ACTIVE_TAB', url })
      .catch(() => null);

    if (!response?.ok) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSave = async () => {
    setState('saving');
    setErrorMsg(null);

    try {
      const result = await saveToLibrary({
        url: page.url,
        title: page.title,
        byline: page.byline,
        content: page.content,
      });

      // Save chat history alongside the article
      if (messages.length > 0) {
        await saveChatHistory(result.id, messages).catch(() => {
          // Non-fatal: article saved but chat history failed
        });
      }

      setSavedId(result.id);
      setState('saved');
      await openInActiveTab(result.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save';
      setErrorMsg(message);
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  };

  if (state === 'saved' && savedId) {
    return (
      <a
        href={`${getApiBase()}/reader/${savedId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm font-medium text-emerald-200 hover:bg-emerald-500/15"
      >
        Open in Web Annotator
        <ExternalLink className="h-4 w-4" />
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleSave()}
      disabled={state === 'saving'}
      className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
      title={state === 'error' ? errorMsg || 'Error' : 'Open in Web Annotator'}
    >
      {state === 'saving' ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Importing...
        </>
      ) : (
        <>
          <ExternalLink className="h-4 w-4" />
          Open in Web Annotator
        </>
      )}
    </button>
  );
}
