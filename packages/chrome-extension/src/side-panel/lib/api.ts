import type { AIChatMessage, AIConfig } from './types';

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (typeof chrome !== 'undefined' && chrome.runtime?.id
    ? 'https://web-annotator.vercel.app'
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

export async function streamChat(
  config: AIConfig,
  systemPrompt: string,
  messages: AIChatMessage[],
  signal?: AbortSignal,
  isAuthenticated = false
): Promise<ReadableStream<Uint8Array> | null> {
  const endpoint = isAuthenticated ? '/api/ai/chat' : '/api/ext/chat';

  const body = isAuthenticated
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

  const auth = isAuthenticated ? await authHeaders() : {};

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
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export async function saveToLibrary(article: {
  url: string;
  title: string;
  byline?: string | null;
  content: string;
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
