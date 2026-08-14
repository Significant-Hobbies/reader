import type { AIChatMessage } from './types';

const CHAT_HISTORY_PREFIX = 'chat:';
const MAX_CACHED_CONVERSATIONS = 20;

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
