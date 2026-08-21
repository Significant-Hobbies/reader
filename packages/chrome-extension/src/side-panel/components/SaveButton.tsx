import { useEffect, useMemo, useState } from 'react';
import { BookmarkPlus, CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';
import type { PageContent, AIChatMessage } from '../lib/types';
import {
  findLibraryItemByUrl,
  saveToLibrary,
  saveChatHistory,
  getApiBase,
  saveLinkToLibrary,
  updateLibraryItemCategory,
  type ReaderLibraryItem,
} from '../lib/api';
import { upsertChromeReadingListEntry } from '../lib/reading-list-sync';

interface SaveButtonProps {
  page: PageContent;
  messages: AIChatMessage[];
  canImport: boolean;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type LookupState = 'checking' | 'found' | 'missing' | 'error';

const CATEGORY_SUGGESTIONS = [
  'Read later',
  'Research papers',
  'Blogs',
  'Products to try',
  'AI and ML',
  'Engineering',
];

async function openInActiveTab(articleId: string): Promise<void> {
  const url = `${getApiBase()}/reader/${articleId}`;
  const response = await chrome.runtime
    .sendMessage({ type: 'OPEN_URL_IN_ACTIVE_TAB', url })
    .catch(() => null);

  if (!response?.ok) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

function SavedView(props: { savedId: string; savedWasExisting: boolean; trimmedCategory: string }) {
  const { savedId, savedWasExisting, trimmedCategory } = props;
  return (
    <div className="grid grid-cols-1 gap-2">
      <div className="flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5 text-emerald-100">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {savedWasExisting ? 'Already in Library' : 'Saved to Library'}
          </p>
          {trimmedCategory && (
            <p className="truncate text-xs text-emerald-100/70">Category: {trimmedCategory}</p>
          )}
        </div>
      </div>
      <a
        href={`${getApiBase()}/reader/${savedId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-sm font-medium text-emerald-200 hover:bg-emerald-500/15"
      >
        Open in Reader Library
        <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  );
}

function CategoryInput(props: {
  category: string;
  setCategory: (v: string) => void;
  existingItem: ReaderLibraryItem | null;
}) {
  const { category, setCategory, existingItem } = props;
  return (
    <div className="grid gap-1.5">
      <label htmlFor="reader-category" className="text-xs font-medium text-gray-300">
        Category
      </label>
      <input
        id="reader-category"
        list="reader-category-suggestions"
        value={category}
        onChange={(event) => setCategory(event.target.value)}
        placeholder={existingItem?.category || 'Read later, papers, products...'}
        className="h-9 w-full rounded-lg border border-gray-700 bg-gray-950 px-2.5 text-sm text-gray-100 outline-none placeholder:text-gray-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30"
      />
      <datalist id="reader-category-suggestions">
        {CATEGORY_SUGGESTIONS.map((suggestion) => (
          <option key={suggestion} value={suggestion} />
        ))}
      </datalist>
    </div>
  );
}

function LookupStatus(props: {
  lookupState: LookupState;
  existingItem: ReaderLibraryItem | null;
}) {
  const { lookupState, existingItem } = props;
  if (lookupState === 'checking') {
    return (
      <p className="rounded-lg border border-gray-800 bg-gray-950 px-2.5 py-2 text-xs text-gray-400">
        Checking Reader Library...
      </p>
    );
  }
  if (lookupState === 'found' && existingItem) {
    return (
      <a
        href={`${getApiBase()}/reader/${existingItem.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-2 text-xs text-emerald-100 hover:bg-emerald-500/15"
      >
        <span className="min-w-0 truncate">
          Already in Library{existingItem.category ? ` · ${existingItem.category}` : ''}
        </span>
        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
      </a>
    );
  }
  return null;
}

function ActionButtons(props: {
  state: SaveState;
  canImport: boolean;
  errorMsg: string | null;
  onSaveLink: () => void;
  onSave: () => void;
}) {
  const { state, canImport, errorMsg, onSaveLink, onSave } = props;
  return (
    <>
      <button
        type="button"
        onClick={() => void onSaveLink()}
        disabled={state === 'saving'}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        title={state === 'error' ? errorMsg || 'Error' : 'Save to Reader Library'}
      >
        {state === 'saving' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <BookmarkPlus className="h-4 w-4" />
            Save to Library
          </>
        )}
      </button>
      <button
        type="button"
        onClick={() => void onSave()}
        disabled={state === 'saving' || !canImport}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-700 bg-gray-900 px-3 py-2.5 text-sm font-medium text-gray-100 hover:bg-gray-800 disabled:opacity-50"
        title={
          !canImport
            ? 'This page cannot be imported directly'
            : state === 'error'
              ? errorMsg || 'Error'
              : 'Import and open in Reader'
        }
      >
        <ExternalLink className="h-4 w-4" />
        Import & Read
      </button>
    </>
  );
}

async function doSave(ctx: {
  page: PageContent;
  messages: AIChatMessage[];
  canImport: boolean;
  trimmedCategory: string;
  existingItem: ReaderLibraryItem | null;
  setState: (s: SaveState) => void;
  setSavedId: (id: string | null) => void;
  setSavedWasExisting: (v: boolean) => void;
  setExistingItem: (updater: (item: ReaderLibraryItem | null) => ReaderLibraryItem | null) => void;
  setLookupState: (s: LookupState) => void;
  setErrorMsg: (e: string | null) => void;
}) {
  if (!ctx.canImport) {
    ctx.setErrorMsg('This page cannot be imported directly.');
    ctx.setState('error');
    setTimeout(() => ctx.setState('idle'), 3000);
    return;
  }

  ctx.setState('saving');
  ctx.setErrorMsg(null);

  try {
    const result = await saveToLibrary({
      url: ctx.page.url,
      title: ctx.page.title,
      byline: ctx.page.byline,
      content: ctx.page.content,
      category: ctx.trimmedCategory || undefined,
    });
    if (ctx.trimmedCategory) {
      await updateLibraryItemCategory(result.id, ctx.trimmedCategory);
      ctx.setExistingItem((item) =>
        item?.id === result.id ? { ...item, category: ctx.trimmedCategory } : item
      );
    }
    await upsertChromeReadingListEntry({
      url: ctx.page.url,
      title: ctx.page.title || ctx.page.url,
      articleId: result.id,
      itemType: 'article',
    });

    if (ctx.messages.length > 0) {
      await saveChatHistory(result.id, ctx.messages).catch(() => {});
    }

    ctx.setSavedId(result.id);
    ctx.setSavedWasExisting(result.existing);
    ctx.setState('saved');
    ctx.setExistingItem(() => ({
      id: result.id,
      url: ctx.page.url,
      title: ctx.page.title,
      type: 'article',
      category: ctx.trimmedCategory || ctx.existingItem?.category,
    }));
    ctx.setLookupState('found');
    await openInActiveTab(result.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save';
    ctx.setErrorMsg(message);
    ctx.setState('error');
    setTimeout(() => ctx.setState('idle'), 3000);
  }
}

async function doSaveLink(ctx: {
  page: PageContent;
  trimmedCategory: string;
  existingItem: ReaderLibraryItem | null;
  setState: (s: SaveState) => void;
  setSavedId: (id: string | null) => void;
  setSavedWasExisting: (v: boolean) => void;
  setExistingItem: (updater: (item: ReaderLibraryItem | null) => ReaderLibraryItem | null) => void;
  setLookupState: (s: LookupState) => void;
  setErrorMsg: (e: string | null) => void;
}) {
  ctx.setState('saving');
  ctx.setErrorMsg(null);

  try {
    const result = await saveLinkToLibrary({
      url: ctx.page.url,
      title: ctx.page.title || ctx.page.url,
      category: ctx.trimmedCategory || undefined,
    });
    if (ctx.trimmedCategory) {
      await updateLibraryItemCategory(result.id, ctx.trimmedCategory);
      ctx.setExistingItem((item) =>
        item?.id === result.id ? { ...item, category: ctx.trimmedCategory } : item
      );
    }
    await upsertChromeReadingListEntry({
      url: ctx.page.url,
      title: ctx.page.title || ctx.page.url,
      articleId: result.id,
      itemType: 'link',
    });
    ctx.setSavedId(result.id);
    ctx.setSavedWasExisting(result.existing);
    ctx.setState('saved');
    ctx.setExistingItem(() => ({
      id: result.id,
      url: ctx.page.url,
      title: ctx.page.title || ctx.page.url,
      type: 'link',
      category: ctx.trimmedCategory || ctx.existingItem?.category,
    }));
    ctx.setLookupState('found');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save link';
    ctx.setErrorMsg(message);
    ctx.setState('error');
    setTimeout(() => ctx.setState('idle'), 3000);
  }
}

export function SaveButton({ page, messages, canImport }: SaveButtonProps) {
  const [state, setState] = useState<SaveState>('idle');
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedWasExisting, setSavedWasExisting] = useState(false);
  const [category, setCategory] = useState('');
  const [lookupState, setLookupState] = useState<LookupState>('checking');
  const [existingItem, setExistingItem] = useState<ReaderLibraryItem | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const trimmedCategory = useMemo(() => category.trim(), [category]);

  useEffect(() => {
    let cancelled = false;
    setLookupState('checking');
    setExistingItem(null);

    findLibraryItemByUrl(page.url)
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
  }, [page.url]);

  const handleSave = () =>
    doSave({
      page,
      messages,
      canImport,
      trimmedCategory,
      existingItem,
      setState,
      setSavedId,
      setSavedWasExisting,
      setExistingItem,
      setLookupState,
      setErrorMsg,
    });

  const handleSaveLink = () =>
    doSaveLink({
      page,
      trimmedCategory,
      existingItem,
      setState,
      setSavedId,
      setSavedWasExisting,
      setExistingItem,
      setLookupState,
      setErrorMsg,
    });

  if (state === 'saved' && savedId) {
    return (
      <SavedView
        savedId={savedId}
        savedWasExisting={savedWasExisting}
        trimmedCategory={trimmedCategory}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2">
      <CategoryInput category={category} setCategory={setCategory} existingItem={existingItem} />
      <LookupStatus lookupState={lookupState} existingItem={existingItem} />
      <ActionButtons
        state={state}
        canImport={canImport}
        errorMsg={errorMsg}
        onSaveLink={handleSaveLink}
        onSave={handleSave}
      />
    </div>
  );
}
