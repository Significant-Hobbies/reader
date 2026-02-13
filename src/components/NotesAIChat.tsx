'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCompletion } from '@ai-sdk/react';
import { Bot, Loader2, Send, Settings, Square, Trash2, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Note, Article } from '../types';
import {
  AIChatMessage,
  AI_CONFIG_STORAGE_KEY,
  AIConfig,
  FALLBACK_MODELS,
  getDefaultModelForProvider,
  isLocalAIProvider,
  normalizeAvailableAIProvider,
  prioritizeStableModelIds,
  PROVIDER_LABELS,
  type AIProvider,
  DEFAULT_AI_CONFIG,
  isLocalCLIEnabled,
} from '../lib/ai-config';

interface NotesAIChatProps {
  article: Pick<Article, 'id' | 'title' | 'url' | 'byline' | 'content' | 'aiChat'>;
  notes: Note[];
  queuedPrompt?: string | null;
  onQueuedPromptHandled?: () => void;
}

interface ModelDiscoveryResponse {
  models?: Array<{ id?: string }>;
  source?: 'live' | 'fallback';
  error?: string;
}

const MAX_SAVED_MESSAGES = 80;
const SAVE_DEBOUNCE_MS = 750;

const serializeMessages = (messages: AIChatMessage[]) =>
  JSON.stringify(messages.map((message) => [message.role, message.content]));

const includeSelectedModel = (selectedModel: string, modelIds: string[]) => {
  if (!selectedModel) return modelIds;
  if (modelIds.includes(selectedModel)) return modelIds;
  return [selectedModel, ...modelIds];
};

const loadConfig = (allowLocalProviders: boolean): AIConfig => {
  if (typeof window === 'undefined') return DEFAULT_AI_CONFIG;

  try {
    const raw = window.localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_AI_CONFIG;

    const parsed = JSON.parse(raw) as Partial<AIConfig>;
    const provider = normalizeAvailableAIProvider(parsed.provider, allowLocalProviders);
    const model =
      typeof parsed.model === 'string' && parsed.model.trim()
        ? parsed.model.trim()
        : getDefaultModelForProvider(provider);

    return {
      provider,
      model,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
    };
  } catch {
    return DEFAULT_AI_CONFIG;
  }
};

const persistConfig = (config: AIConfig) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(config));
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
  const [isConfigLoaded, setIsConfigLoaded] = useState(false);
  const [allowLocalProviders, setAllowLocalProviders] = useState(false);
  const [config, setConfig] = useState<AIConfig>(DEFAULT_AI_CONFIG);
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>(
    FALLBACK_MODELS[DEFAULT_AI_CONFIG.provider]
  );
  const [modelSource, setModelSource] = useState<'live' | 'fallback'>('fallback');
  const [modelError, setModelError] = useState<string | null>(null);
  const [isModelsLoading, setIsModelsLoading] = useState(false);

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
      setError(streamError instanceof Error ? streamError.message : 'AI request failed');
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
    const localProvidersAllowed = isLocalCLIEnabled();
    setAllowLocalProviders(localProvidersAllowed);
    setConfig(loadConfig(localProvidersAllowed));
    setIsConfigLoaded(true);
  }, []);

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
    setMessages(hydratedMessages);
    latestMessagesRef.current = hydratedMessages;
    lastPersistedMessagesRef.current = hydratedSignature;
    hasHydratedMessagesRef.current = true;
  }, [article.id, article.aiChat, setCompletion]);

  useEffect(() => {
    latestMessagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (!isConfigLoaded) return;
    persistConfig(config);
  }, [config, isConfigLoaded]);

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
          setError(persistError instanceof Error ? persistError.message : 'Failed to save chat');
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

  useEffect(() => {
    const controller = new AbortController();

    const fetchModels = async () => {
      setIsModelsLoading(true);
      setModelError(null);

      try {
        const response = await fetch('/api/ai/models', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            provider: config.provider,
            apiKey: config.apiKey,
          }),
          signal: controller.signal,
        });

        const payload = (await response.json().catch(() => ({}))) as ModelDiscoveryResponse;

        if (!response.ok) {
          throw new Error(payload.error || `Model fetch failed with status ${response.status}`);
        }

        const ids = Array.isArray(payload.models)
          ? payload.models
              .map((model) => (typeof model?.id === 'string' ? model.id.trim() : ''))
              .filter((id) => id.length > 0)
          : [];

        const nextModels =
          ids.length > 0
            ? prioritizeStableModelIds(ids)
            : (FALLBACK_MODELS[config.provider] ?? [getDefaultModelForProvider(config.provider)]);

        setAvailableModels(includeSelectedModel(config.model, nextModels));
        setModelSource(payload.source === 'live' ? 'live' : 'fallback');
        setModelError(payload.error ?? null);
      } catch (fetchError) {
        if (controller.signal.aborted) return;

        setModelSource('fallback');
        setModelError(fetchError instanceof Error ? fetchError.message : 'Failed to fetch models');

        const fallbackModels = FALLBACK_MODELS[config.provider] ?? [
          getDefaultModelForProvider(config.provider),
        ];
        setAvailableModels(includeSelectedModel(config.model, fallbackModels));
      } finally {
        if (!controller.signal.aborted) {
          setIsModelsLoading(false);
        }
      }
    };

    fetchModels();

    return () => controller.abort();
  }, [config.provider, config.apiKey, config.model]);

  const isReady = useMemo(() => {
    if (isLocalAIProvider(config.provider)) return true;
    if (config.provider === 'gateway') return true;
    return Boolean(config.apiKey.trim());
  }, [config]);

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
        setError(`Add an API key for ${PROVIDER_LABELS[config.provider]}.`);
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
            provider: config.provider,
            model: config.model,
            apiKey: config.apiKey,
            messages: nextHistory,
            systemPrompt: buildSystemPrompt(article, notes),
          },
        });
      } catch (streamError) {
        if ((streamError as { name?: string })?.name !== 'AbortError') {
          setError(streamError instanceof Error ? streamError.message : 'AI request failed');
        }
        pendingHistoryRef.current = null;
      }
    },
    [article, complete, config, input, isReady, isStreaming, messages, notes, setCompletion]
  );

  useEffect(() => {
    if (!queuedPrompt) return;
    const normalizedPrompt = queuedPrompt.trim();
    if (!normalizedPrompt) {
      onQueuedPromptHandled?.();
      return;
    }

    setInput('');
    void sendMessage(normalizedPrompt);
    onQueuedPromptHandled?.();
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
              <p className="text-xs text-gray-500">{PROVIDER_LABELS[config.provider]}</p>
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
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-xs text-gray-400">
                <span>Provider</span>
                <select
                  value={config.provider}
                  onChange={(event) => {
                    const provider = event.target.value as AIProvider;
                    setConfig((prev) => ({
                      ...prev,
                      provider,
                      model: getDefaultModelForProvider(provider),
                    }));
                  }}
                  className="h-10 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {allowLocalProviders && (
                    <optgroup label="Local CLI (no API key)">
                      <option value="claude-code">Claude Code</option>
                      <option value="codex">Codex CLI</option>
                      <option value="gemini-cli">Gemini CLI</option>
                    </optgroup>
                  )}
                  <optgroup label="Cloud API (BYOK)">
                    <option value="gateway">Vercel AI Gateway</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="google">Google Gemini</option>
                  </optgroup>
                </select>
              </label>

              <label className="space-y-1 text-xs text-gray-400">
                <span>
                  Model{' '}
                  {isModelsLoading ? <span className="text-gray-500">(refreshing)</span> : null}
                </span>
                <select
                  value={config.model}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      model: event.target.value,
                    }))
                  }
                  className="h-10 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableModels.map((modelId) => (
                    <option key={modelId} value={modelId}>
                      {modelId}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {!isLocalAIProvider(config.provider) && (
              <label className="space-y-1 text-xs text-gray-400">
                <span>API key (stored in your browser only)</span>
                <input
                  type="password"
                  value={config.apiKey}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      apiKey: event.target.value,
                    }))
                  }
                  placeholder="Paste your API key"
                  className="h-10 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
            )}

            {isLocalAIProvider(config.provider) && (
              <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                Local CLI mode is enabled. Run `../cli-bridge` on port 3456 to stream responses from
                your local CLI tools.
              </p>
            )}

            <p className="text-[11px] text-gray-500">
              Model catalog source:{' '}
              {modelSource === 'live' ? 'live provider data' : 'fallback list'}
            </p>
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
        {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
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
              isReady ? 'Ask about this article or your notes...' : 'Add API key in settings'
            }
            className="min-h-[68px] flex-1 resize-none rounded-xl border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
