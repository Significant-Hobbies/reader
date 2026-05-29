import { useCallback, useEffect, useState } from 'react';
import type { PageContent, AIChatMessage, AuthState } from './lib/types';
import { DEFAULT_AI_CONFIG } from './lib/types';
import { loadChatHistory, saveChatHistory as saveChatToStorage } from './lib/storage';
import { checkAuth, getApiKey } from './lib/api';
import { getImportNotice, type ImportNotice } from './lib/importQuality';
import { Chat } from './components/Chat';
import { PageHeader } from './components/PageHeader';
import { TTSPlayer } from './components/TTSPlayer';

export function App() {
  const [page, setPage] = useState<PageContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [importNotice, setImportNotice] = useState<ImportNotice | null>(null);
  const [auth, setAuth] = useState<AuthState>({ isAuthenticated: false, user: null });

  const extractPage = useCallback(async () => {
    setLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_PAGE_CONTENT' });
      if (response?.data) {
        setPage(response.data);
        setImportNotice(getImportNotice(response.data, Boolean(response.fallback)));
        const cached = await loadChatHistory(response.data.url);
        setMessages(cached);
      } else {
        setPage(null);
        setImportNotice(getImportNotice(null, Boolean(response?.fallback)));
      }
    } catch {
      setPage(null);
      setImportNotice(getImportNotice(null));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load config; if an API key is stored, verify it and hydrate user.
    getApiKey().then((key) => {
      if (!key) return;
      checkAuth().then((user) => {
        if (user) {
          setAuth({ isAuthenticated: true, user });
        }
      });
    });

    extractPage();
  }, [extractPage]);

  // Listen for tab navigation
  useEffect(() => {
    const listener = (message: { type: string }) => {
      if (message.type === 'TAB_UPDATED') {
        extractPage();
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [extractPage]);

  // Persist chat history
  useEffect(() => {
    if (page?.url && messages.length > 0) {
      saveChatToStorage(page.url, messages);
    }
  }, [messages, page?.url]);

  const handleAuthChange = useCallback((next: AuthState) => {
    setAuth(next);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <PageHeader page={page} auth={auth} onAuthChange={handleAuthChange} />
      <TTSPlayer
        getText={() => {
          if (!page) return '';
          const title = page.title?.trim();
          const body = (page.textContent ?? '').trim();
          return title ? `${title}.\n\n${body}` : body;
        }}
      />
      <Chat
        page={page}
        messages={messages}
        setMessages={setMessages}
        config={DEFAULT_AI_CONFIG}
        auth={auth}
        importNotice={importNotice}
      />
    </div>
  );
}
