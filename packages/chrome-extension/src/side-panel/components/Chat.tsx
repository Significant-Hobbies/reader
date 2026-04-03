import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Loader2, Send, Settings, Square, Trash2, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { PageContent, AIChatMessage, AIConfig, AuthState } from '../lib/types';
import { PROVIDER_LABELS } from '../lib/types';
import { streamChat } from '../lib/api';
import { SettingsPanel } from './SettingsPanel';
import { QuickActions } from './QuickActions';
import { SaveButton } from './SaveButton';

interface ChatProps {
  page: PageContent | null;
  messages: AIChatMessage[];
  setMessages: (messages: AIChatMessage[]) => void;
  config: AIConfig;
  onConfigChange: (config: AIConfig) => void;
  auth: AuthState;
}

const stripHTML = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function buildSystemPrompt(page: PageContent | null): string {
  if (!page) {
    return 'You are an AI assistant. The user has not loaded a page yet.';
  }

  const textExcerpt = (page.textContent || stripHTML(page.content)).slice(0, 4000);

  return [
    'You are an AI reading assistant embedded in a Chrome extension.',
    'Help the user understand the current webpage.',
    'Keep responses concise and practical.',
    'If you are unsure, explicitly say so.',
    '',
    `Page title: ${page.title || 'Untitled'}`,
    `Page URL: ${page.url}`,
    page.byline ? `Byline: ${page.byline}` : '',
    '',
    `Page content excerpt:\n${textExcerpt}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function Chat({ page, messages, setMessages, config, onConfigChange, auth }: ChatProps) {
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isReady = config.provider === 'gateway' || Boolean(config.apiKey.trim());

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const sendMessage = useCallback(
    async (text?: string) => {
      const userMessage = (text ?? input).trim();
      if (!userMessage || isStreaming) return;

      if (!isReady && auth.isAuthenticated) {
        setShowSettings(true);
        setError(`Add an API key for ${PROVIDER_LABELS[config.provider]}.`);
        return;
      }

      setError(null);
      if (!text) setInput('');

      const nextMessages: AIChatMessage[] = [...messages, { role: 'user', content: userMessage }];

      // Add empty assistant message for streaming
      setMessages([...nextMessages, { role: 'assistant', content: '' }]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const body = await streamChat(
          config,
          buildSystemPrompt(page),
          nextMessages,
          controller.signal,
          auth.isAuthenticated
        );

        if (!body) throw new Error('No response body');

        const reader = body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          fullResponse += chunk;

          setMessages([...nextMessages, { role: 'assistant', content: fullResponse }]);
        }

        setMessages([...nextMessages, { role: 'assistant', content: fullResponse }]);
      } catch (err) {
        if ((err as { name?: string })?.name === 'AbortError') {
          // User cancelled - keep what we have
          return;
        }
        const message = err instanceof Error ? err.message : 'Something went wrong';
        setError(message);
        // Remove the empty assistant message
        setMessages(nextMessages);
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [input, isStreaming, isReady, auth, config, page, messages, setMessages]
  );

  const stopStreaming = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header bar */}
      <div className="border-b border-gray-800 bg-gray-900/80 px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-blue-500/15 p-1 text-blue-300">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <span className="text-xs text-gray-400">
              {auth.isAuthenticated ? PROVIDER_LABELS[config.provider] : 'Free tier'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {page && auth.isAuthenticated && messages.length > 0 && (
              <SaveButton page={page} messages={messages} />
            )}
            {messages.length > 0 && (
              <button
                type="button"
                onClick={clearChat}
                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                title="Clear chat"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            {auth.isAuthenticated && (
              <button
                type="button"
                onClick={() => setShowSettings((prev) => !prev)}
                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                title="Settings"
              >
                {showSettings ? (
                  <X className="h-3.5 w-3.5" />
                ) : (
                  <Settings className="h-3.5 w-3.5" />
                )}
              </button>
            )}
          </div>
        </div>

        {showSettings && auth.isAuthenticated && (
          <SettingsPanel config={config} onConfigChange={onConfigChange} />
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3">
        {messages.length === 0 ? (
          <div className="mt-6 space-y-3">
            <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/40 p-3 text-center text-xs text-gray-500">
              {page ? 'Ask anything about this page' : 'Navigate to a page to start chatting'}
            </div>
            {page && (
              <QuickActions
                onAction={(prompt) => void sendMessage(prompt)}
                disabled={isStreaming}
              />
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {messages.map((msg, i) => (
              <div
                key={`${msg.role}-${i}-${msg.content.length}`}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm ${
                    msg.role === 'user'
                      ? 'rounded-br-md bg-blue-600 text-white'
                      : 'rounded-bl-md border border-gray-700 bg-gray-800 text-gray-100'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-invert prose-sm max-w-none break-words">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )}
                  {isStreaming && i === messages.length - 1 && msg.role === 'assistant' && (
                    <span className="ml-1 inline-block h-3 w-1 animate-pulse rounded-sm bg-blue-300" />
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 bg-gray-900/70 p-3">
        {error && (
          <p className="mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-200">
            {error}
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
            rows={2}
            placeholder={
              page
                ? isReady || !auth.isAuthenticated
                  ? 'Ask about this page...'
                  : 'Add API key in settings'
                : 'Navigate to a page first'
            }
            disabled={!page}
            className="min-h-[56px] flex-1 resize-none rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={stopStreaming}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-500/40 bg-red-500/15 text-red-300 hover:bg-red-500/25"
              title="Stop"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={!input.trim() || !page}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              title="Send"
            >
              {isStreaming ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
