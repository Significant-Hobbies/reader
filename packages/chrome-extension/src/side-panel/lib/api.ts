import type { AIChatMessage, AIConfig } from './types';

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (typeof chrome !== 'undefined' && chrome.runtime?.id
    ? 'https://reader.sarthakagrawal927.workers.dev'
    : 'http://localhost:3000');

const API_KEY_STORAGE_KEY = 'api-key';

export function getApiBase(): string {
  return API_BASE;
}

export async function getApiKey(): Promise<string | null> {
  try {
    const result = await chrome.storage.local.get(API_KEY_STORAGE_KEY);
    const value = result[API_KEY_STORAGE_KEY];
    return typeof value === 'string' && value.startsWith('rdr_') ? value : null;
  } catch {
    return null;
  }
}

export async function setApiKey(key: string): Promise<void> {
  await chrome.storage.local.set({ [API_KEY_STORAGE_KEY]: key });
}

export async function clearApiKey(): Promise<void> {
  await chrome.storage.local.remove(API_KEY_STORAGE_KEY);
}

async function authHeaders(): Promise<Record<string, string>> {
  const key = await getApiKey();
  if (!key) return {};
  return { Authorization: `Bearer ${key}` };
}

export interface ReaderLibraryItem {
  id: string;
  url: string;
  title: string;
  type?: 'article' | 'pdf' | 'link';
  category?: string;
  status?: 'in_progress' | 'read';
  createdAt?: string;
}

function normalizeUrlForLookup(value: string): string {
  try {
    const url = new URL(value);
    url.hash = '';
    const normalized = url.toString();
    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
  } catch {
    return value.trim().replace(/\/$/, '');
  }
}

export async function listLibraryItems(): Promise<ReaderLibraryItem[]> {
  const auth = await authHeaders();
  const response = await fetch(`${API_BASE}/api/articles`, {
    headers: auth,
    cache: 'no-store',
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error((payload as { error?: string }).error || 'Failed to check library');
  }

  const payload = (await response.json()) as unknown;
  return Array.isArray(payload) ? (payload as ReaderLibraryItem[]) : [];
}

export async function findLibraryItemByUrl(url: string): Promise<ReaderLibraryItem | null> {
  const normalizedTarget = normalizeUrlForLookup(url);
  const items = await listLibraryItems();
  return items.find((item) => normalizeUrlForLookup(item.url) === normalizedTarget) ?? null;
}

export async function streamChat(
  config: AIConfig,
  systemPrompt: string,
  messages: AIChatMessage[],
  signal?: AbortSignal,
  isAuthenticated = false
): Promise<ReadableStream<Uint8Array> | null> {
  const usesReaderGateway = config.provider === 'gateway' && !config.apiKey;
  const endpoint = usesReaderGateway ? '/api/ext/chat' : '/api/ai/chat';

  const body =
    endpoint === '/api/ai/chat'
      ? {
          provider: config.provider,
          model: config.model,
          apiKey: config.apiKey,
          systemPrompt,
          messages,
        }
      : {
          systemPrompt,
          messages: messages.slice(-6),
        };

  const auth = endpoint === '/api/ai/chat' || isAuthenticated ? await authHeaders() : {};

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(
      (payload as { error?: string }).error || `Chat request failed (${response.status})`
    );
  }

  return response.body;
}

export async function checkAuth(): Promise<{
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
} | null> {
  try {
    const auth = await authHeaders();
    if (!auth.Authorization) return null;

    const response = await fetch(`${API_BASE}/api/auth/me`, {
      headers: auth,
      cache: 'no-store',
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export async function verifyApiKeyForUser(key: string): Promise<
  | {
      ok: true;
      user: {
        uid: string;
        email: string;
        displayName: string;
        photoURL: string;
      };
    }
  | { ok: false; error: string }
> {
  try {
    const response = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      return {
        ok: false,
        error:
          payload.error ||
          (response.status === 401
            ? 'Reader rejected this key. Create a fresh extension key and paste the full token.'
            : `Reader returned ${response.status} while checking this key.`),
      };
    }

    return { ok: true, user: await response.json() };
  } catch {
    return {
      ok: false,
      error: `Could not reach Reader at ${API_BASE}. Reload the extension after rebuilding it.`,
    };
  }
}

export async function saveToLibrary(article: {
  url: string;
  title: string;
  byline?: string | null;
  content: string;
  category?: string;
}): Promise<{ id: string; existing: boolean }> {
  const auth = await authHeaders();
  const response = await fetch(`${API_BASE}/api/articles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify(article),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error((payload as { error?: string }).error || 'Failed to save article');
  }

  return response.json();
}

export async function saveLinkToLibrary(link: {
  url: string;
  title: string;
  category?: string;
}): Promise<{ id: string; existing: boolean }> {
  const auth = await authHeaders();
  const response = await fetch(`${API_BASE}/api/articles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({
      url: link.url,
      title: link.title,
      content: '',
      type: 'link',
      category: link.category,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error((payload as { error?: string }).error || 'Failed to save link');
  }

  return response.json();
}

export async function updateLibraryItemCategory(
  articleId: string,
  category: string
): Promise<void> {
  const auth = await authHeaders();
  const response = await fetch(`${API_BASE}/api/articles/${articleId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ category }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error((payload as { error?: string }).error || 'Failed to update category');
  }
}

export async function updateLibraryItemReadingListFields(
  articleId: string,
  fields: {
    title?: string;
    status?: 'in_progress' | 'read';
  }
): Promise<void> {
  const payload: Record<string, string> = {};
  if (fields.title) payload.title = fields.title;
  if (fields.status) payload.status = fields.status;
  if (Object.keys(payload).length === 0) return;

  const auth = await authHeaders();
  const response = await fetch(`${API_BASE}/api/articles/${articleId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}));
    throw new Error(
      (errorPayload as { error?: string }).error || 'Failed to update reading list item'
    );
  }
}

export async function deleteLibraryItem(articleId: string): Promise<void> {
  const auth = await authHeaders();
  const response = await fetch(`${API_BASE}/api/articles/${articleId}`, {
    method: 'DELETE',
    headers: auth,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error((payload as { error?: string }).error || 'Failed to delete library item');
  }
}

export async function saveChatHistory(articleId: string, messages: AIChatMessage[]): Promise<void> {
  const auth = await authHeaders();
  const response = await fetch(`${API_BASE}/api/articles/${articleId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ aiChat: messages }),
  });

  if (!response.ok) {
    throw new Error('Failed to save chat history');
  }
}
