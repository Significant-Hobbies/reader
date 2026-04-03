import type { AIChatMessage, AIConfig } from './types';

const API_BASE =
  typeof chrome !== 'undefined' && chrome.runtime?.id
    ? 'https://web-annotator.vercel.app'
    : 'http://localhost:3000';

export function getApiBase(): string {
  return API_BASE;
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

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: isAuthenticated ? 'include' : 'omit',
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
    const response = await fetch(`${API_BASE}/api/auth/me`, {
      credentials: 'include',
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
  const response = await fetch(`${API_BASE}/api/articles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(article),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error((payload as { error?: string }).error || 'Failed to save article');
  }

  return response.json();
}

export async function saveChatHistory(articleId: string, messages: AIChatMessage[]): Promise<void> {
  const response = await fetch(`${API_BASE}/api/articles/${articleId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ aiChat: messages }),
  });

  if (!response.ok) {
    throw new Error('Failed to save chat history');
  }
}

export async function createSession(idToken: string): Promise<boolean> {
  const response = await fetch(`${API_BASE}/api/auth/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ idToken }),
  });
  return response.ok;
}
