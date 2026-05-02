import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink, KeyRound, Loader2, MessageCircle, User } from 'lucide-react';
import type { AuthState, PageContent } from '../side-panel/lib/types';
import {
  checkAuth,
  clearApiKey,
  getApiBase,
  getApiKey,
  saveToLibrary,
  setApiKey,
  verifyApiKeyForUser,
} from '../side-panel/lib/api';
import { getImportNotice, type ImportNotice } from '../side-panel/lib/importQuality';

type LoadState = 'loading' | 'ready';
type ActionState = 'idle' | 'working' | 'error';

async function getCurrentPage(): Promise<{
  page: PageContent | null;
  notice: ImportNotice | null;
}> {
  const response = await chrome.runtime.sendMessage({ type: 'GET_PAGE_CONTENT' }).catch(() => null);
  const page = response?.data ?? null;
  return { page, notice: getImportNotice(page, Boolean(response?.fallback)) };
}

async function openUrlInActiveTab(url: string): Promise<boolean> {
  const response = await chrome.runtime
    .sendMessage({ type: 'OPEN_URL_IN_ACTIVE_TAB', url })
    .catch(() => null);
  return Boolean(response?.ok);
}

async function openChatPanel(): Promise<boolean> {
  if (chrome.sidePanel?.open) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs[0]?.id;
    if (tabId) {
      await chrome.sidePanel.open({ tabId });
      return true;
    }
  }

  const response = await chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' }).catch(() => null);
  return Boolean(response?.ok);
}

export function App() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [auth, setAuth] = useState<AuthState>({ isAuthenticated: false, user: null });
  const [page, setPage] = useState<PageContent | null>(null);
  const [importNotice, setImportNotice] = useState<ImportNotice | null>(null);
  const [showConnect, setShowConnect] = useState(false);
  const [keyValue, setKeyValue] = useState('');
  const [actionState, setActionState] = useState<ActionState>('idle');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadState('loading');
    const [storedKey, currentPage] = await Promise.all([getApiKey(), getCurrentPage()]);
    setPage(currentPage.page);
    setImportNotice(currentPage.notice);

    if (storedKey) {
      const user = await checkAuth();
      setAuth(user ? { isAuthenticated: true, user } : { isAuthenticated: false, user: null });
    } else {
      setAuth({ isAuthenticated: false, user: null });
    }

    setLoadState('ready');
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = async () => {
    const trimmed = keyValue.trim();
    if (!trimmed.startsWith('rdr_')) {
      setError('Key must start with rdr_');
      return;
    }

    setActionState('working');
    setError(null);
    const result = await verifyApiKeyForUser(trimmed);
    if (result.ok) {
      await setApiKey(trimmed);
      setAuth({ isAuthenticated: true, user: result.user });
      setShowConnect(false);
      setKeyValue('');
      setActionState('idle');
      return;
    }

    await clearApiKey();
    setError(result.error);
    setActionState('error');
  };

  const openInAnnotator = async () => {
    if (!page) {
      setError('No readable page detected.');
      return;
    }

    setActionState('working');
    setError(null);
    try {
      const article = await saveToLibrary({
        url: page.url,
        title: page.title,
        byline: page.byline,
        content: page.content,
      });
      const opened = await openUrlInActiveTab(`${getApiBase()}/reader/${article.id}`);
      if (!opened) {
        chrome.tabs.create({ url: `${getApiBase()}/reader/${article.id}` });
      }
      window.close();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open page.');
      setActionState('error');
    }
  };

  const chatWithThis = async () => {
    const opened = await openChatPanel();
    if (opened) {
      window.close();
      return;
    }
    setError('Could not open chat.');
  };

  if (loadState === 'loading') {
    return (
      <div className="flex h-[160px] w-[380px] items-center justify-center bg-gray-950 text-gray-100">
        <Loader2 className="h-5 w-5 animate-spin text-blue-300" />
      </div>
    );
  }

  return (
    <div className="w-[380px] bg-gray-950 p-3 text-gray-100">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{page?.title || 'No page detected'}</p>
          <p className="truncate text-xs text-gray-500">{page?.siteName || page?.url || ''}</p>
        </div>
        {auth.isAuthenticated && (
          <div className="shrink-0 text-gray-400" title={auth.user?.email || 'Connected'}>
            {auth.user?.photoURL ? (
              <img src={auth.user.photoURL} alt="" className="h-7 w-7 rounded-full" />
            ) : (
              <User className="h-5 w-5" />
            )}
          </div>
        )}
      </div>
      {importNotice && (
        <div className="mb-3 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium">{importNotice.title}</p>
            <p className="mt-0.5 text-xs leading-4 text-amber-100/75">{importNotice.message}</p>
          </div>
        </div>
      )}

      {!auth.isAuthenticated ? (
        <div className="space-y-2">
          {!showConnect ? (
            <button
              type="button"
              onClick={() => setShowConnect(true)}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-500"
            >
              <KeyRound className="h-4 w-4" />
              Connect
            </button>
          ) : (
            <div className="space-y-2">
              <a
                href={`${getApiBase()}/extension`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-gray-700 text-xs font-medium text-gray-200 hover:bg-gray-900"
              >
                Create extension key
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <input
                type="password"
                value={keyValue}
                onChange={(event) => setKeyValue(event.target.value)}
                placeholder="rdr_..."
                className="h-9 w-full rounded-lg border border-gray-700 bg-gray-900 px-2 text-xs text-gray-100 outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => void connect()}
                disabled={!keyValue.trim() || actionState === 'working'}
                className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {actionState === 'working' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save key
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => void openInAnnotator()}
            disabled={!page || actionState === 'working'}
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {actionState === 'working' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            Open in Annotator
          </button>
          <button
            type="button"
            onClick={() => void chatWithThis()}
            disabled={!page}
            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 text-xs font-medium text-gray-100 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <MessageCircle className="h-4 w-4" />
            Chat with this
          </button>
        </div>
      )}

      {error && (
        <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}
