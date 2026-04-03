import { useState } from 'react';
import { BookmarkPlus, Check, ExternalLink, Loader2 } from 'lucide-react';
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

      // Reset after 5 seconds
      setTimeout(() => setState('idle'), 5000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save';
      setErrorMsg(message);
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  };

  if (state === 'saved' && savedId) {
    return (
      <div className="flex items-center gap-1">
        <span className="flex items-center gap-1 text-xs text-emerald-400">
          <Check className="h-3.5 w-3.5" />
          Saved
        </span>
        <a
          href={`${getApiBase()}/reader/${savedId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md p-1 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
          title="Open in Web Annotator"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleSave()}
      disabled={state === 'saving'}
      className="rounded-md p-1.5 text-gray-400 hover:bg-gray-800 hover:text-gray-200 disabled:opacity-50"
      title={state === 'error' ? errorMsg || 'Error' : 'Save to Library'}
    >
      {state === 'saving' ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <BookmarkPlus className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
