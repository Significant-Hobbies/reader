import type { AIConfig, AIChatMessage, AuthState } from './types';
import { AI_CONFIG_STORAGE_KEY, DEFAULT_AI_CONFIG } from './types';

const CHAT_HISTORY_PREFIX = 'chat:';
const AUTH_STATE_KEY = 'auth-state';
const MAX_CACHED_CONVERSATIONS = 20;

export async function loadAIConfig(): Promise<AIConfig> {
  try {
    const result = await chrome.storage.local.get(AI_CONFIG_STORAGE_KEY);
    const raw = result[AI_CONFIG_STORAGE_KEY];
    if (!raw) return DEFAULT_AI_CONFIG;

    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return {
      provider: parsed.provider || DEFAULT_AI_CONFIG.provider,
      model: parsed.model || DEFAULT_AI_CONFIG.model,
      apiKey: parsed.apiKey || '',
    };
  } catch {
    return DEFAULT_AI_CONFIG;
  }
}

export async function saveAIConfig(config: AIConfig): Promise<void> {
  await chrome.storage.local.set({ [AI_CONFIG_STORAGE_KEY]: config });
}

export async function loadChatHistory(url: string): Promise<AIChatMessage[]> {
  try {
    const key = CHAT_HISTORY_PREFIX + url;
    const result = await chrome.storage.local.get(key);
    return Array.isArray(result[key]) ? result[key] : [];
  } catch {
    return [];
  }
}

export async function saveChatHistory(url: string, messages: AIChatMessage[]): Promise<void> {
  const key = CHAT_HISTORY_PREFIX + url;
  await chrome.storage.local.set({ [key]: messages });
  await pruneOldConversations();
}

async function pruneOldConversations(): Promise<void> {
  const all = await chrome.storage.local.get(null);
  const chatKeys = Object.keys(all).filter((k) => k.startsWith(CHAT_HISTORY_PREFIX));
  if (chatKeys.length <= MAX_CACHED_CONVERSATIONS) return;

  const toRemove = chatKeys.slice(0, chatKeys.length - MAX_CACHED_CONVERSATIONS);
  await chrome.storage.local.remove(toRemove);
}

export async function loadAuthState(): Promise<AuthState> {
  try {
    const result = await chrome.storage.local.get(AUTH_STATE_KEY);
    return result[AUTH_STATE_KEY] || { isAuthenticated: false, user: null };
  } catch {
    return { isAuthenticated: false, user: null };
  }
}

export async function saveAuthState(state: AuthState): Promise<void> {
  await chrome.storage.local.set({ [AUTH_STATE_KEY]: state });
}

export async function clearAuthState(): Promise<void> {
  await chrome.storage.local.set({
    [AUTH_STATE_KEY]: { isAuthenticated: false, user: null },
  });
}
