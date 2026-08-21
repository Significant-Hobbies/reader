import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BookmarkPlus,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  MessageCircle,
  User,
} from 'lucide-react';
import type { AuthState, PageContent } from '../side-panel/lib/types';
import {
  checkAuth,
  clearApiKey,
  findLibraryItemByUrl,
  getApiBase,
  getApiKey,
  saveLinkToLibrary,
  saveToLibrary,
  setApiKey,
  updateLibraryItemCategory,
  verifyApiKeyForUser,
  type ReaderLibraryItem,
} from '../side-panel/lib/api';
import { canImportPage, getImportNotice, type ImportNotice } from '../side-panel/lib/importQuality';
import {
  syncAllChromeReadingListToReader,
  upsertChromeReadingListEntry,
} from '../side-panel/lib/reading-list-sync';

type LoadState = 'loading' | 'ready';
type ActionState = 'idle' | 'working' | 'error';
type LookupState = 'idle' | 'checking' | 'found' | 'missing' | 'error';

const CATEGORY_SUGGESTIONS = [
  'Read later',
  'Research papers',
  'Blogs',
  'Products to try',
  'AI and ML',
  'Engineering',
];

async function getCurrentPage(): Promise<{
  page: PageContent | null;
  notice: ImportNotice | null;
}> {
  const response = await chrome.runtime.sendMessage({ type: 'GET_PAGE_CONTENT' }).catch(() => null);
  const page = response?.data ?? null;
  const usedFallback = Boolean(response?.fallback);
  return {
    page: page ? { ...page, canImport: canImportPage(page, usedFallback) } : null,
    notice: getImportNotice(page, usedFallback),
  };
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

async function doConnect(ctx: {
  keyValue: string;
  setAuth: (a: AuthState) => void;
  setShowConnect: (v: boolean) => void;
  setKeyValue: (v: string) => void;
  setActionState: (s: ActionState) => void;
  setError: (e: string | null) => void;
}) {
  const trimmed = ctx.keyValue.trim();
  if (!trimmed.startsWith('rdr_')) {
    ctx.setError('Key must start with rdr_');
    return;
  }

  ctx.setActionState('working');
  ctx.setError(null);
  const result = await verifyApiKeyForUser(trimmed);
  if (result.ok) {
    await setApiKey(trimmed);
    await syncAllChromeReadingListToReader().catch(() => null);
    ctx.setAuth({ isAuthenticated: true, user: result.user });
    ctx.setShowConnect(false);
    ctx.setKeyValue('');
    ctx.setActionState('idle');
    return;
  }

  await clearApiKey();
  ctx.setError(result.error);
  ctx.setActionState('error');
}

async function doOpenInAnnotator(ctx: {
  page: PageContent | null;
  notice: ImportNotice | null;
  category: string;
  setActionState: (s: ActionState) => void;
  setError: (e: string | null) => void;
}) {
  if (!ctx.page) {
    ctx.setError('No readable page detected.');
    return;
  }
  if (ctx.page.canImport === false || ctx.notice?.blocking) {
    ctx.setError('This page cannot be imported directly.');
    return;
  }

  ctx.setActionState('working');
  ctx.setError(null);
  try {
    const trimmedCategory = ctx.category.trim();
    const article = await saveToLibrary({
      url: ctx.page.url,
      title: ctx.page.title,
      byline: ctx.page.byline,
      content: ctx.page.content,
      category: trimmedCategory || undefined,
    });
    if (trimmedCategory) {
      await updateLibraryItemCategory(article.id, trimmedCategory);
    }
    await upsertChromeReadingListEntry({
      url: ctx.page.url,
      title: ctx.page.title || ctx.page.url,
      articleId: article.id,
      itemType: 'article',
    });
    const opened = await openUrlInActiveTab(`${getApiBase()}/reader/${article.id}`);
    if (!opened) {
      chrome.tabs.create({ url: `${getApiBase()}/reader/${article.id}` });
    }
    window.close();
  } catch (err) {
    ctx.setError(err instanceof Error ? err.message : 'Failed to open page.');
    ctx.setActionState('error');
  }
}

async function doSaveLink(ctx: {
  page: PageContent | null;
  category: string;
  setActionState: (s: ActionState) => void;
  setError: (e: string | null) => void;
}) {
  if (!ctx.page) {
    ctx.setError('No page detected.');
    return;
  }

  ctx.setActionState('working');
  ctx.setError(null);
  try {
    const trimmedCategory = ctx.category.trim();
    const result = await saveLinkToLibrary({
      url: ctx.page.url,
      title: ctx.page.title || ctx.page.url,
      category: trimmedCategory || undefined,
    });
    if (trimmedCategory) {
      await updateLibraryItemCategory(result.id, trimmedCategory);
    }
    await upsertChromeReadingListEntry({
      url: ctx.page.url,
      title: ctx.page.title || ctx.page.url,
      articleId: result.id,
      itemType: 'link',
    });
    ctx.setActionState('idle');
    window.close();
  } catch (err) {
    ctx.setError(err instanceof Error ? err.message : 'Failed to save link.');
    ctx.setActionState('error');
  }
}

async function doChatWithThis(setError: (e: string | null) => void) {
  const opened = await openChatPanel();
  if (opened) {
    window.close();
    return;
  }
  setError('Could not open chat.');
}

function usePopupState() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [auth, setAuth] = useState<AuthState>({ isAuthenticated: false, user: null });
  const [pageState, setPageState] = useState<PageContent | null>(null);
  const [noticeState, setNoticeState] = useState<ImportNotice | null>(null);
  const [showConnect, setShowConnect] = useState(false);
  const [keyValue, setKeyValue] = useState('');
  const [category, setCategory] = useState('');
  const [lookupState, setLookupState] = useState<LookupState>('idle');
  const [existingItem, setExistingItem] = useState<ReaderLibraryItem | null>(null);
  const [actionState, setActionState] = useState<ActionState>('idle');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadState('loading');
    const [storedKey, currentPage] = await Promise.all([getApiKey(), getCurrentPage()]);
    setPageState(currentPage.page);
    setNoticeState(currentPage.notice);

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

  useEffect(() => {
    if (!auth.isAuthenticated || !pageState?.url) {
      setLookupState('idle');
      setExistingItem(null);
      return;
    }

    let cancelled = false;
    setLookupState('checking');
    setExistingItem(null);

    findLibraryItemByUrl(pageState.url)
      .then((item) => {
        if (cancelled) return;
        setExistingItem(item);
        setLookupState(item ? 'found' : 'missing');
      })
      .catch(() => {
        if (cancelled) return;
        setLookupState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [auth.isAuthenticated, pageState?.url]);

  const connect = () =>
    doConnect({ keyValue, setAuth, setShowConnect, setKeyValue, setActionState, setError });
  const openInAnnotator = () =>
    doOpenInAnnotator({
      page: pageState,
      notice: noticeState,
      category,
      setActionState,
      setError,
    });
  const saveLink = () =>
    doSaveLink({ page: pageState, category, setActionState, setError });
  const chatWithThis = () => doChatWithThis(setError);

  return {
    loadState,
    auth,
    page: pageState,
    importNotice: noticeState,
    showConnect,
    keyValue,
    category,
    lookupState,
    existingItem,
    actionState,
    error,
    setKeyValue,
    setCategory,
    setShowConnect,
    connect,
    openInAnnotator,
    saveLink,
    chatWithThis,
  };
}

type PopupState = ReturnType<typeof usePopupState>;

function PopupHeader(props: { page: PageContent | null; auth: AuthState }) {
  const { page, auth } = props;
  return (
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
  );
}

function ImportNoticeBanner(props: { notice: ImportNotice }) {
  const { notice } = props;
  return (
    <div className="mb-3 flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-amber-100">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-medium">{notice.title}</p>
        <p className="mt-0.5 text-xs leading-4 text-amber-100/75">{notice.message}</p>
      </div>
    </div>
  );
}

function ConnectForm(props: PopupState) {
  const { showConnect, setShowConnect, keyValue, setKeyValue, actionState, connect } = props;
  if (!showConnect) {
    return (
      <button
        type="button"
        onClick={() => setShowConnect(true)}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-500"
      >
        <KeyRound className="h-4 w-4" />
        Connect
      </button>
    );
  }

  return (
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
  );
}

function AuthenticatedActions(props: PopupState) {
  const {
    page,
    importNotice,
    category,
    setCategory,
    lookupState,
    existingItem,
    actionState,
    saveLink,
    openInAnnotator,
    chatWithThis,
  } = props;
  return (
    <div className="grid grid-cols-1 gap-2">
      <div className="grid gap-1.5">
        <label htmlFor="reader-popup-category" className="text-xs font-medium text-gray-300">
          Category
        </label>
        <input
          id="reader-popup-category"
          list="reader-popup-category-suggestions"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder={existingItem?.category || 'Read later, papers, products...'}
          className="h-9 w-full rounded-lg border border-gray-700 bg-gray-900 px-2 text-xs text-gray-100 outline-none placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500"
        />
        <datalist id="reader-popup-category-suggestions">
          {CATEGORY_SUGGESTIONS.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      </div>
      {lookupState === 'checking' && (
        <p className="rounded-lg border border-gray-800 bg-gray-900 px-2 py-1.5 text-xs text-gray-400">
          Checking Reader Library...
        </p>
      )}
      {lookupState === 'found' && existingItem && (
        <a
          href={`${getApiBase()}/reader/${existingItem.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2 py-1.5 text-xs text-emerald-100 hover:bg-emerald-500/15"
        >
          <span className="min-w-0 truncate">
            <CheckCircle2 className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
            Already in Library{existingItem.category ? ` · ${existingItem.category}` : ''}
          </span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        </a>
      )}
      <button
        type="button"
        onClick={() => void saveLink()}
        disabled={!page || actionState === 'working'}
        className="flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {actionState === 'working' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <BookmarkPlus className="h-4 w-4" />
        )}
        Save to Library
      </button>
      <button
        type="button"
        onClick={() => void openInAnnotator()}
        disabled={
          !page ||
          page.canImport === false ||
          importNotice?.blocking ||
          actionState === 'working'
        }
        className="flex h-10 items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 text-xs font-medium text-gray-100 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        title={
          page?.canImport === false || importNotice?.blocking
            ? 'This page cannot be imported directly'
            : 'Import and open in Reader'
        }
      >
        <ExternalLink className="h-4 w-4" />
        Import & Read
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
  );
}

export function App() {
  const state = usePopupState();
  const { loadState, auth, page, importNotice, error } = state;

  if (loadState === 'loading') {
    return (
      <div className="flex h-[160px] w-[380px] items-center justify-center bg-gray-950 text-gray-100">
        <Loader2 className="h-5 w-5 animate-spin text-blue-300" />
      </div>
    );
  }

  return (
    <div className="w-[380px] bg-gray-950 p-3 text-gray-100">
      <PopupHeader page={page} auth={auth} />
      {importNotice && <ImportNoticeBanner notice={importNotice} />}
      {!auth.isAuthenticated ? (
        <div className="space-y-2">
          <ConnectForm {...state} />
        </div>
      ) : (
        <AuthenticatedActions {...state} />
      )}
      {error && (
        <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-1.5 text-xs text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}
