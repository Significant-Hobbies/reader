'use client';

import type { Article, ArticleStatus, List } from '../types';

const DB_NAME = 'reader-local-library';
const DB_VERSION = 1;
const ARTICLES_STORE = 'articles';
const LISTS_STORE = 'lists';

type LocalArticle = Article & {
  pdfDataUrl?: string;
};

const DEFAULT_LISTS: List[] = [
  {
    id: 'local-read-later',
    name: 'Read Later',
    userId: 'local',
    icon: 'clock',
    isDefault: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'local-favourites',
    name: 'Favourites',
    userId: 'local',
    icon: 'heart',
    isDefault: true,
    createdAt: new Date().toISOString(),
  },
];

function assertBrowser() {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    throw new Error('Local library is only available in the browser');
  }
}

function openLocalDb(): Promise<IDBDatabase> {
  assertBrowser();

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ARTICLES_STORE)) {
        db.createObjectStore(ARTICLES_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(LISTS_STORE)) {
        db.createObjectStore(LISTS_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open local library'));
  });
}

function runStore<T>(
  storeName: typeof ARTICLES_STORE | typeof LISTS_STORE,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | undefined> {
  return openLocalDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const request = action(store);
        let result: T | undefined;

        if (request) {
          request.onsuccess = () => {
            result = request.result;
          };
          request.onerror = () =>
            reject(request.error ?? new Error('Local library request failed'));
        }

        transaction.oncomplete = () => {
          db.close();
          resolve(result);
        };
        transaction.onerror = () => {
          db.close();
          reject(transaction.error ?? new Error('Local library transaction failed'));
        };
      })
  );
}

async function ensureDefaultLists() {
  const lists = await getLocalListsRaw();
  if (lists.length > 0) return;

  await Promise.all(DEFAULT_LISTS.map((list) => putLocalList(list)));
}

async function getLocalListsRaw(): Promise<List[]> {
  const lists = await runStore<List[]>(LISTS_STORE, 'readonly', (store) => store.getAll());
  return lists ?? [];
}

async function putLocalList(list: List) {
  await runStore(LISTS_STORE, 'readwrite', (store) => store.put(list));
}

export async function getLocalLists(): Promise<List[]> {
  await ensureDefaultLists();
  const lists = await getLocalListsRaw();
  return lists.sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1;
    if (!a.isDefault && b.isDefault) return 1;
    return (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
  });
}

export async function createLocalList(name: string): Promise<List> {
  const now = new Date().toISOString();
  const list: List = {
    id: `local-list-${crypto.randomUUID()}`,
    name,
    userId: 'local',
    icon: 'dot',
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
  await putLocalList(list);
  return list;
}

export async function deleteLocalList(listId: string) {
  const lists = await getLocalLists();
  const list = lists.find((item) => item.id === listId);
  if (list?.isDefault) {
    throw new Error('Default lists cannot be deleted');
  }

  await runStore(LISTS_STORE, 'readwrite', (store) => store.delete(listId));
  const articles = await getLocalArticles();
  await Promise.all(
    articles
      .filter((article) => article.listIds?.includes(listId))
      .map((article) =>
        updateLocalArticle(article.id, {
          listIds: (article.listIds ?? []).filter((id) => id !== listId),
        })
      )
  );
}

export async function getLocalArticles(): Promise<LocalArticle[]> {
  const articles = await runStore<LocalArticle[]>(ARTICLES_STORE, 'readonly', (store) =>
    store.getAll()
  );
  return (articles ?? []).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

export async function getLocalArticle(id: string): Promise<LocalArticle | null> {
  const article = await runStore<LocalArticle>(ARTICLES_STORE, 'readonly', (store) =>
    store.get(id)
  );
  return article ?? null;
}

export async function saveLocalArticle(
  article: Omit<LocalArticle, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'notesCount'>
): Promise<LocalArticle> {
  const now = new Date().toISOString();
  const saved: LocalArticle = {
    ...article,
    id: `local-article-${crypto.randomUUID()}`,
    userId: 'local',
    status: article.status ?? 'in_progress',
    notes: article.notes ?? [],
    notesCount: article.notes?.length ?? 0,
    listIds: article.listIds ?? [],
    tags: article.tags ?? [],
    createdAt: now,
    updatedAt: now,
  };

  await runStore(ARTICLES_STORE, 'readwrite', (store) => store.put(saved));
  return saved;
}

export async function updateLocalArticle(
  id: string,
  patch: Partial<Omit<LocalArticle, 'id' | 'createdAt' | 'userId'>>
): Promise<LocalArticle> {
  const article = await getLocalArticle(id);
  if (!article) {
    throw new Error('Local item not found');
  }

  const updated: LocalArticle = {
    ...article,
    ...patch,
    notesCount: patch.notes ? patch.notes.length : (patch.notesCount ?? article.notesCount ?? 0),
    updatedAt: new Date().toISOString(),
  };

  await runStore(ARTICLES_STORE, 'readwrite', (store) => store.put(updated));
  return updated;
}

export async function deleteLocalArticle(id: string) {
  await runStore(ARTICLES_STORE, 'readwrite', (store) => store.delete(id));
}

export async function addLocalArticleToList(articleId: string, listId: string) {
  const article = await getLocalArticle(articleId);
  if (!article) throw new Error('Local item not found');

  const listIds = Array.from(new Set([...(article.listIds ?? []), listId]));
  return updateLocalArticle(articleId, { listIds });
}

export async function removeLocalArticleFromList(articleId: string, listId: string) {
  const article = await getLocalArticle(articleId);
  if (!article) throw new Error('Local item not found');

  return updateLocalArticle(articleId, {
    listIds: (article.listIds ?? []).filter((id) => id !== listId),
  });
}

export async function getLocalTags(): Promise<string[]> {
  const articles = await getLocalArticles();
  return Array.from(new Set(articles.flatMap((article) => article.tags ?? []))).sort();
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function estimateReadingTimeFromHtml(html: string): number {
  const text = html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return 1;
  return Math.max(1, Math.ceil(text.split(' ').length / 220));
}

export async function updateLocalStatus(articleId: string, status: ArticleStatus) {
  return updateLocalArticle(articleId, { status });
}
