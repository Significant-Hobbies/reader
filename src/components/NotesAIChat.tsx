'use client';

import { useCompletion } from '@ai-sdk/react';
import { useAIConfig, useModelDiscovery } from '@saas-maker/ai';
import { useQueryClient } from '@tanstack/react-query';
import { Bot, Loader2, Send, Settings, Square, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { AIChatMessage } from '../lib/ai-config';
import { AI_CONFIG_STORAGE_KEY, isLocalCLIEnabled } from '../lib/ai-config';
import type { Article, Note } from '../types';

interface NotesAIChatProps {
  article: Pick<Article, 'id' | 'title' | 'url' | 'byline' | 'content' | 'aiChat'>;
  notes: Note[];
  queuedPrompt?: string | null;
  onQueuedPromptHandled?: () => void;
}

const MAX_SAVED_MESSAGES = 80;
const SAVE_DEBOUNCE_MS = 750;
const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

const serializeMessages = (messages: AIChatMessage[]) =>
  JSON.stringify(messages.map((message) => [message.role, message.content]));

const toCompactErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return message.replace(/\s+/g, ' ').trim().slice(0, 260);
};

const toUserFacingError = (
  error: unknown,
  context: 'chat' | 'persist' | 'models'
): { message: string; openSettings: boolean } => {
  const raw = toCompactErrorMessage(error);
  const lower = raw.toLowerCase();

  if (
    lower.includes('api key') ||
    lower.includes('apikey') ||
    lower.includes('unauthorized') ||
    lower.includes('401')
  ) {
    return {
      message: 'Invalid or missing API key. Check your settings.',
      openSettings: true,
    };
  }

  if (
    lower.includes('rate limit') ||
    lower.includes('429') ||
    lower.includes('too many requests')
  ) {
    return {
      message: 'Rate limited. Wait a moment and try again.',
      openSettings: false,
    };
  }

  if (lower.includes('fetch') || lower.includes('network') || lower.includes('econnrefused')) {
    if (context === 'persist')
      return {
        message: 'Could not save chat history. Will retry automatically.',
        openSettings: false,
      };
    return {
      message: 'Could not reach the endpoint. Check your connection and URL.',
      openSettings: true,
    };
  }

  if (context === 'persist')
    return { message: 'Failed to save chat history.', openSettings: false };
  if (context === 'models')
    return {
      message: 'Could not load models from that endpoint.',
      openSettings: true,
    };

  return { message: raw || GENERIC_ERROR_MESSAGE, openSettings: false };
};

const stripHTML = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildSystemPrompt = (article: NotesAIChatProps['article'], notes: Note[]) => {
  const textExcerpt = stripHTML(article.content || '').slice(0, 4000);
  const notesContext = notes
    .slice(0, 40)
    .map((note, index) => {
      const label = note.anchor?.tagName
        ? `${note.anchor.tagName.toLowerCase()} #${(note.anchor.elementIndex ?? 0) + 1}`
        : `note #${index + 1}`;
      const noteText = (note.text || note.anchor?.textPreview || '').trim().slice(0, 240);
      return `${index + 1}. (${label}) ${noteText || '[empty note]'}`;
    })
    .join('\n');

  return [
    'You are an AI reading assistant embedded in a web annotation app.',
    'Help the user understand this article and improve their notes.',
    'Keep responses concise and practical.',
    'If you are unsure, explicitly say so.',
    '',
    `Article title: ${article.title || 'Untitled'}`,
    `Article URL: ${article.url}`,
    article.byline ? `Article byline: ${article.byline}` : '',
    '',
    `Article excerpt:\n${textExcerpt}`,
    '',
    notesContext ? `Current notes:\n${notesContext}` : 'Current notes: none yet',
  ]
    .filter(Boolean)
    .join('\n');
};

export function NotesAIChat({
  article,
  notes,
  queuedPrompt = null,
  onQueuedPromptHandled,
}: NotesAIChatProps) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowLocalAI] = useState(() => isLocalCLIEnabled());
  const [useLocalAI, setUseLocalAI] = useState(false);
  const { config, setConfig, save: saveConfig } = useAIConfig(AI_CONFIG_STORAGE_KEY);
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const {
    models: availableModels,
    loading: isModelsLoading,
    error: modelError,
    discover: discoverModels,
  } = useModelDiscovery({ modelsApiUrl: '/api/ai/models' });
  const [customModelInput, setCustomModelInput] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const hasHydratedMessagesRef = useRef(false);
  const pendingHistoryRef = useRef<AIChatMessage[] | null>(null);
  const skipNextPersistRef = useRef(true);
  const lastPersistedMessagesRef = useRef('[]');
  const latestMessagesRef = useRef<AIChatMessage[]>([]);

  const {
    completion,
    complete,
    stop,
    setCompletion,
    isLoading: isStreaming,
  } = useCompletion({
    api: '/api/ai/chat',
    streamProtocol: 'text',
    fetch: async (requestInfo, requestInit) => {
      const response = await fetch(requestInfo, requestInit);
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || 'Unable to start AI response stream');
      }
      return response;
    },
    onError: (streamError) => {
      const feedback = toUserFacingError(streamError, 'chat');
      setError(feedback.message);
      if (feedback.openSettings) setShowSettings(true);
      pendingHistoryRef.current = null;
    },
    onFinish: (_prompt, finalCompletion) => {
      const pendingHistory = pendingHistoryRef.current;
      if (!pendingHistory) return;

      setMessages([
        ...pendingHistory,
        {
          role: 'assistant',
          content: finalCompletion,
        },
      ]);
      pendingHistoryRef.current = null;
    },
  });

  useEffect(() => {
    const hydratedMessages = Array.isArray(article.aiChat) ? article.aiChat : [];
    const hydratedSignature = serializeMessages(hydratedMessages);
    const localSignature = serializeMessages(latestMessagesRef.current);

    if (hasHydratedMessagesRef.current && hydratedSignature === localSignature) {
      return;
    }

    skipNextPersistRef.current = true;
    pendingHistoryRef.current = null;
    setCompletion('');
    queueMicrotask(() => setMessages(hydratedMessages));
    latestMessagesRef.current = hydratedMessages;
    lastPersistedMessagesRef.current = hydratedSignature;
    hasHydratedMessagesRef.current = true;
  }, [article.id, article.aiChat, setCompletion]);

  useEffect(() => {
    latestMessagesRef.current = messages;
  }, [messages]);

  // Auto-persist config changes to localStorage
  const setConfigAndSave: typeof setConfig = useCallback(
    (next) => {
      setConfig((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        // Persist asynchronously to avoid setState-in-setState
        queueMicrotask(() => saveConfig());
        return resolved;
      });
    },
    [setConfig, saveConfig]
  );

  useEffect(() => {
    if (!hasHydratedMessagesRef.current) return;
    if (skipNextPersistRef.current) return;
    queryClient.setQueryData<Article>(['article', article.id], (previousArticle) => {
      if (!previousArticle) return previousArticle;

      const previousChat = Array.isArray(previousArticle.aiChat) ? previousArticle.aiChat : [];
      if (serializeMessages(previousChat) === serializeMessages(messages)) {
        return previousArticle;
      }

      return {
        ...previousArticle,
        aiChat: messages,
      };
    });
  }, [article.id, messages, queryClient]);

  const persistMessagesToServer = useCallback(
    async (payload: AIChatMessage[], keepalive = false) => {
      const response = await fetch(`/api/articles/${article.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        keepalive,
        body: JSON.stringify({ aiChat: payload }),
      });
      if (!response.ok) {
        throw new Error('Failed to save AI chat history');
      }
    },
    [article.id]
  );

  useEffect(() => {
    if (!hasHydratedMessagesRef.current) return;
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }

    const payload = messages.slice(-MAX_SAVED_MESSAGES);
    const serializedPayload = serializeMessages(payload);
    if (serializedPayload === lastPersistedMessagesRef.current) {
      return;
    }

    const timeoutId = setTimeout(() => {
      void persistMessagesToServer(payload)
        .then(() => {
          lastPersistedMessagesRef.current = serializedPayload;
        })
        .catch((persistError) => {
          const feedback = toUserFacingError(persistError, 'persist');
          setError(feedback.message);
        });
    }, SAVE_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [messages, persistMessagesToServer]);

  useEffect(
    () => () => {
      if (!hasHydratedMessagesRef.current) return;

      const payload = latestMessagesRef.current.slice(-MAX_SAVED_MESSAGES);
      const serializedPayload = serializeMessages(payload);
      if (serializedPayload === lastPersistedMessagesRef.current) return;

      void persistMessagesToServer(payload, true).catch(() => {
        // Ignore cleanup errors when navigating away.
      });
    },
    [persistMessagesToServer]
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  useEffect(() => {
    const pendingHistory = pendingHistoryRef.current;
    if (!pendingHistory) return;

    setMessages([
      ...pendingHistory,
      {
        role: 'assistant',
        content: completion,
      },
    ]);
  }, [completion]);

  // Fetch models when endpoint URL + key change
  useEffect(() => {
    if (useLocalAI || !config.endpointUrl) {
      return;
    }

    discoverModels(config.endpointUrl, config.apiKey);
  }, [config.endpointUrl, config.apiKey, useLocalAI, discoverModels]);

  const isReady = useMemo(() => {
    if (useLocalAI) return true;
    return Boolean(config.endpointUrl.trim() && config.model.trim());
  }, [config.endpointUrl, config.model, useLocalAI]);

  const sendMessage = useCallback(
    async (queuedMessage?: string) => {
      const userMessage = (queuedMessage ?? input).trim();
      const isQueuedMessage = typeof queuedMessage === 'string';

      if (!userMessage) return;
      if (isStreaming) {
        if (isQueuedMessage) {
          setInput(userMessage);
        }
        return;
      }

      if (!isReady) {
        setShowSettings(true);
        setError('Configure your AI endpoint in settings.');
        if (isQueuedMessage) {
          setInput(userMessage);
        }
        return;
      }

      setError(null);
      if (!isQueuedMessage) {
        setInput('');
      }

      const nextHistory: AIChatMessage[] = [...messages, { role: 'user', content: userMessage }];
      pendingHistoryRef.current = nextHistory;
      setMessages([...nextHistory, { role: 'assistant', content: '' }]);
      setCompletion('');

      try {
        await complete(userMessage, {
          body: {
            endpointUrl: useLocalAI ? undefined : config.endpointUrl,
            model: config.model,
            apiKey: useLocalAI ? undefined : config.apiKey,
            local: useLocalAI || undefined,
            messages: nextHistory,
            systemPrompt: buildSystemPrompt(article, notes),
          },
        });
      } catch (streamError) {
        if ((streamError as { name?: string })?.name !== 'AbortError') {
          const feedback = toUserFacingError(streamError, 'chat');
          setError(feedback.message);
          if (feedback.openSettings) setShowSettings(true);
        }
        pendingHistoryRef.current = null;
      }
    },
    [
      article,
      complete,
      config,
      input,
      isReady,
      isStreaming,
      messages,
      notes,
      setCompletion,
      useLocalAI,
    ]
  );

  useEffect(() => {
    if (!queuedPrompt) return;
    const normalizedPrompt = queuedPrompt.trim();
    if (!normalizedPrompt) {
      onQueuedPromptHandled?.();
      return;
    }

    queueMicrotask(() => {
      setInput('');
      void sendMessage(normalizedPrompt);
      onQueuedPromptHandled?.();
    });
  }, [queuedPrompt, onQueuedPromptHandled, sendMessage]);

  const stopStreaming = () => {
    stop();
    pendingHistoryRef.current = null;
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-gray-800 bg-gray-900/80 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="rounded-md bg-blue-500/15 p-1.5 text-blue-300">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-100">AI Chat</p>
              {config.model && !useLocalAI && (
                <p className="text-xs text-gray-500">{config.model}</p>
              )}
              {useLocalAI && <p className="text-xs text-emerald-400">Local AI</p>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={clearChat}
                className="rounded-md p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200"
                title="Clear chat"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowSettings((prev) => !prev)}
              className="rounded-md p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200"
              title="Chat settings"
            >
              {showSettings ? <X className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {showSettings && (
          <div className="mt-3 space-y-3 rounded-xl border border-gray-800 bg-gray-950/80 p-3">
            {allowLocalAI && (
              <label className="flex items-center gap-2 text-xs text-gray-400">
                <input
                  type="checkbox"
                  checked={useLocalAI}
                  onChange={(event) => setUseLocalAI(event.target.checked)}
                  className="rounded border-gray-600 bg-gray-800"
                />
                <span>Use local AI (dev mode)</span>
              </label>
            )}

            {!useLocalAI && (
              <>
                <label className="space-y-1 text-xs text-gray-400">
                  <span>Endpoint URL</span>
                  <input
                    type="text"
                    value={config.endpointUrl}
                    onChange={(event) =>
                      setConfigAndSave((prev) => ({
                        ...prev,
                        endpointUrl: event.target.value,
                      }))
                    }
                    placeholder="https://api.openai.com/v1"
                    className="h-10 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-gray-100 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </label>

                <label className="space-y-1 text-xs text-gray-400">
                  <span>API Key (stored in your browser only)</span>
                  <input
                    type="password"
                    value={config.apiKey}
                    onChange={(event) =>
                      setConfigAndSave((prev) => ({
                        ...prev,
                        apiKey: event.target.value,
                      }))
                    }
                    placeholder="Paste your API key"
                    className="h-10 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-gray-100 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </label>

                <label className="space-y-1 text-xs text-gray-400">
                  <span>
                    Model{' '}
                    {isModelsLoading ? <span className="text-gray-500">(loading...)</span> : null}
                  </span>
                  <div className="relative">
                    <input
                      type="text"
                      list="ai-model-options"
                      value={customModelInput || config.model}
                      onChange={(event) => {
                        const value = event.target.value;
                        setCustomModelInput(value);
                        setConfigAndSave((prev) => ({ ...prev, model: value }));
                      }}
                      onFocus={() => setCustomModelInput(config.model)}
                      onBlur={() => setCustomModelInput('')}
                      placeholder={
                        availableModels.length > 0
                          ? 'Select or type a model name'
                          : 'Enter model name'
                      }
                      className="h-10 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-gray-100 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    <datalist id="ai-model-options">
                      {availableModels.map((modelId) => (
                        <option key={modelId} value={modelId} />
                      ))}
                    </datalist>
                  </div>
                </label>
              </>
            )}

            {useLocalAI && (
              <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                Local AI mode is enabled. Run `pnpm local-ai` to stream responses from your local AI
                tools.
              </p>
            )}

            {modelError && <p className="text-[11px] text-yellow-400">{modelError}</p>}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-gray-700 bg-gray-900/40 p-4 text-center text-sm text-gray-500">
            Ask for summaries, critique your notes, extract action items, or generate study
            questions.
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}-${message.content.length}`}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm ${
                    message.role === 'user'
                      ? 'rounded-br-md bg-blue-600 text-white'
                      : 'rounded-bl-md border border-gray-700 bg-gray-800 text-gray-100'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <div className="prose prose-invert prose-sm max-w-none break-words">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <span className="whitespace-pre-wrap">{message.content}</span>
                  )}
                  {isStreaming && index === messages.length - 1 && message.role === 'assistant' && (
                    <span className="ml-1 inline-block h-3 w-1 animate-pulse rounded-sm bg-blue-300" />
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      <div className="border-t border-gray-800 bg-gray-900/70 p-3">
        {error && (
          <p className="mb-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {error}
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void sendMessage();
              }
            }}
            rows={2}
            placeholder={
              isReady
                ? 'Ask about this article or your notes...'
                : 'Configure AI endpoint in settings'
            }
            className="min-h-[68px] flex-1 resize-none rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={stopStreaming}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/40 bg-red-500/15 text-red-300 transition-colors hover:bg-red-500/25"
              title="Stop"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void sendMessage()}
              disabled={!input.trim() || !isReady}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              title="Send"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
