import {
  deleteLibraryItem,
  findLibraryItemByUrl,
  getApiKey,
  saveLinkToLibrary,
  updateLibraryItemReadingListFields,
  type ReaderLibraryItem,
} from './api';

const SYNC_STATE_KEY = 'reader-reading-list-sync-v1';
const DEFAULT_READING_LIST_CATEGORY = 'Read later';

type ReaderItemType = NonNullable<ReaderLibraryItem['type']>;

interface SyncedReadingListItem {
  articleId: string;
  itemType: ReaderItemType;
  updatedAt: number;
}

interface SyncState {
  urls?: Record<string, SyncedReadingListItem>;
}

type ReadingListEntry = chrome.readingList.ReadingListEntry;
type ReadingListApi = typeof chrome.readingList;

export interface ReadingListSyncResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  articleId?: string;
  existing?: boolean;
}

function getReadingListApi(): ReadingListApi | null {
  const api = (chrome as typeof chrome & { readingList?: ReadingListApi }).readingList;
  return api && typeof api.query === 'function' && typeof api.addEntry === 'function' ? api : null;
}

function normalizeUrlForSync(value: string): string {
  try {
    const url = new URL(value);
    url.hash = '';
    const normalized = url.toString();
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  } catch {
    return value.trim().replace(/\/$/, '');
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

async function readSyncState(): Promise<SyncState> {
  const result = await chrome.storage.local.get(SYNC_STATE_KEY);
  const state = result[SYNC_STATE_KEY];
  return typeof state === 'object' && state !== null ? (state as SyncState) : {};
}

async function writeSyncState(state: SyncState): Promise<void> {
  await chrome.storage.local.set({ [SYNC_STATE_KEY]: state });
}

async function rememberSyncedUrl(
  url: string,
  articleId: string,
  itemType: ReaderItemType
): Promise<void> {
  const state = await readSyncState();
  await writeSyncState({
    ...state,
    urls: {
      ...(state.urls ?? {}),
      [normalizeUrlForSync(url)]: {
        articleId,
        itemType,
        updatedAt: Date.now(),
      },
    },
  });
}

async function forgetSyncedUrl(url: string): Promise<void> {
  const state = await readSyncState();
  const urls = { ...(state.urls ?? {}) };
  delete urls[normalizeUrlForSync(url)];
  await writeSyncState({ ...state, urls });
}

async function getSyncedUrl(url: string): Promise<SyncedReadingListItem | null> {
  const state = await readSyncState();
  return state.urls?.[normalizeUrlForSync(url)] ?? null;
}

function getReaderStatus(entry: Pick<ReadingListEntry, 'hasBeenRead'>): 'in_progress' | 'read' {
  return entry.hasBeenRead ? 'read' : 'in_progress';
}

async function ensureConnected(): Promise<boolean> {
  return Boolean(await getApiKey());
}

export async function upsertChromeReadingListEntry(entry: {
  url: string;
  title: string;
  hasBeenRead?: boolean;
  articleId?: string;
  itemType?: ReaderItemType;
}): Promise<ReadingListSyncResult> {
  const readingList = getReadingListApi();
  if (!readingList) {
    return { ok: false, skipped: true, reason: 'Chrome Reading List API is unavailable.' };
  }

  if (!isHttpUrl(entry.url)) {
    return { ok: false, skipped: true, reason: 'Only http(s) URLs can be synced.' };
  }

  const title = entry.title.trim() || entry.url;
  const matches = await readingList.query({ url: entry.url });
  const current = matches[0];

  if (current) {
    await readingList.updateEntry({
      url: entry.url,
      title,
      hasBeenRead: entry.hasBeenRead ?? current.hasBeenRead,
    });
  } else {
    await readingList.addEntry({
      url: entry.url,
      title,
      hasBeenRead: entry.hasBeenRead ?? false,
    });
  }

  if (entry.articleId && entry.itemType) {
    await rememberSyncedUrl(entry.url, entry.articleId, entry.itemType);
  }

  return { ok: true, articleId: entry.articleId };
}

export async function syncChromeReadingListEntryToReader(
  entry: ReadingListEntry
): Promise<ReadingListSyncResult> {
  if (!(await ensureConnected())) {
    return { ok: false, skipped: true, reason: 'Reader is not connected.' };
  }

  if (!isHttpUrl(entry.url)) {
    return { ok: false, skipped: true, reason: 'Only http(s) URLs can be synced.' };
  }

  const existing = await findLibraryItemByUrl(entry.url);
  if (existing) {
    await rememberSyncedUrl(entry.url, existing.id, existing.type ?? 'article');
    await updateLibraryItemReadingListFields(existing.id, {
      title: existing.type === 'link' ? entry.title : undefined,
      status: getReaderStatus(entry),
    });
    return { ok: true, articleId: existing.id, existing: true };
  }

  const created = await saveLinkToLibrary({
    url: entry.url,
    title: entry.title || entry.url,
    category: DEFAULT_READING_LIST_CATEGORY,
  });
  await updateLibraryItemReadingListFields(created.id, {
    status: getReaderStatus(entry),
  });
  await rememberSyncedUrl(entry.url, created.id, 'link');

  return { ok: true, articleId: created.id, existing: created.existing };
}

export async function syncChromeReadingListRemovalToReader(
  entry: ReadingListEntry
): Promise<ReadingListSyncResult> {
  if (!(await ensureConnected())) {
    return { ok: false, skipped: true, reason: 'Reader is not connected.' };
  }

  const synced = await getSyncedUrl(entry.url);
  if (!synced) {
    return { ok: true, skipped: true, reason: 'No synced Reader item is known for this URL.' };
  }

  const existing = await findLibraryItemByUrl(entry.url).catch(() => null);
  if (existing?.id === synced.articleId && synced.itemType === 'link' && existing.type === 'link') {
    await deleteLibraryItem(existing.id);
  }

  await forgetSyncedUrl(entry.url);
  return { ok: true, articleId: synced.articleId };
}

export async function syncAllChromeReadingListToReader(): Promise<ReadingListSyncResult> {
  const readingList = getReadingListApi();
  if (!readingList) {
    return { ok: false, skipped: true, reason: 'Chrome Reading List API is unavailable.' };
  }

  if (!(await ensureConnected())) {
    return { ok: false, skipped: true, reason: 'Reader is not connected.' };
  }

  const entries = await readingList.query({});
  for (const entry of entries) {
    await syncChromeReadingListEntryToReader(entry);
  }

  return { ok: true };
}
