import { useCallback, useEffect, useState } from 'react';
import type { PageContent, AIChatMessage, AIConfig, AuthState } from './lib/types';
import { DEFAULT_AI_CONFIG } from './lib/types';
import {
  loadAIConfig,
  saveAIConfig,
  loadChatHistory,
  saveChatHistory as saveChatToStorage,
} from './lib/storage';
import { checkAuth, getApiKey } from './lib/api';
import { Chat } from './components/Chat';
import { PageHeader } from './components/PageHeader';

export function App() {
  const [page, setPage] = useState<PageContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [config, setConfig] = useState<AIConfig>(DEFAULT_AI_CONFIG);
  const [auth, setAuth] = useState<AuthState>({ isAuthenticated: false, user: null });

  const extractPage = useCallback(async () => {
    setLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_PAGE_CONTENT' });
      if (response?.data) {
        setPage(response.data);
        const cached = await loadChatHistory(response.data.url);
        setMessages(cached);
      } else {
        setPage(null);
      }
    } catch {
      setPage(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load config; if an API key is stored, verify it and hydrate user.
    loadAIConfig().then(setConfig);
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

  // Persist config changes
  useEffect(() => {
    saveAIConfig(config);
  }, [config]);

  // Persist chat history
  useEffect(() => {
    if (page?.url && messages.length > 0) {
      saveChatToStorage(page.url, messages);
    }
  }, [messages, page?.url]);

  const handleConfigChange = useCallback((next: AIConfig) => {
    setConfig(next);
  }, []);

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
      <Chat
        page={page}
        messages={messages}
        setMessages={setMessages}
        config={config}
        onConfigChange={handleConfigChange}
        auth={auth}
      />
    </div>
  );
}
