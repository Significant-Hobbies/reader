'use client';

import { memo, useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { useCompletion } from '@ai-sdk/react';
import { Bot, Send, Square, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AIChatMessage } from '../../../types';
import {
  AI_CONFIG_STORAGE_KEY,
  AIConfig,
  DEFAULT_AI_CONFIG,
  getDefaultModelForProvider,
  isLocalAIProvider,
  normalizeAvailableAIProvider,
  PROVIDER_LABELS,
  isLocalCLIEnabled,
} from '../../../lib/ai-config';

type AIChatData = {
  messages: AIChatMessage[];
  contextLabel?: string;
};

const loadConfig = (): AIConfig => {
  if (typeof window === 'undefined') return DEFAULT_AI_CONFIG;
  try {
    const raw = window.localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_AI_CONFIG;
    const parsed = JSON.parse(raw) as Partial<AIConfig>;
    const allowLocal = isLocalCLIEnabled();
    const provider = normalizeAvailableAIProvider(parsed.provider, allowLocal);
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

function AIChatNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as AIChatData;
  const { updateNodeData } = useReactFlow();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AIChatMessage[]>(nodeData.messages || []);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pendingHistoryRef = useRef<AIChatMessage[] | null>(null);

  const config = useMemo(() => loadConfig(), []);

  const isReady = useMemo(() => {
    if (isLocalAIProvider(config.provider)) return true;
    if (config.provider === 'gateway') return true;
    return Boolean(config.apiKey.trim());
  }, [config]);

  const {
    completion,
    complete,
    stop,
    setCompletion,
    isLoading: isStreaming,
  } = useCompletion({
    api: '/api/ai/chat',
    streamProtocol: 'text',
    id: `board-chat-${id}`,
    onError: () => {
      pendingHistoryRef.current = null;
    },
    onFinish: (_prompt, finalCompletion) => {
      const pending = pendingHistoryRef.current;
      if (!pending) return;
      const next = [...pending, { role: 'assistant' as const, content: finalCompletion }];
      setMessages(next);
      updateNodeData(id, { messages: next });
      pendingHistoryRef.current = null;
    },
  });

  useEffect(() => {
    if (!pendingHistoryRef.current) return;
    setMessages([...pendingHistoryRef.current, { role: 'assistant', content: completion }]);
  }, [completion]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const sendMessage = useCallback(async () => {
    const userMessage = input.trim();
    if (!userMessage || isStreaming || !isReady) return;
    setInput('');

    const nextHistory: AIChatMessage[] = [...messages, { role: 'user', content: userMessage }];
    pendingHistoryRef.current = nextHistory;
    setMessages([...nextHistory, { role: 'assistant', content: '' }]);
    setCompletion('');

    const systemPrompt = [
      'You are an AI assistant on an infinite canvas board.',
      'Keep responses concise and helpful.',
      nodeData.contextLabel ? `Context: ${nodeData.contextLabel}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await complete(userMessage, {
        body: {
          provider: config.provider,
          model: config.model,
          apiKey: config.apiKey,
          messages: nextHistory,
          systemPrompt,
        },
      });
    } catch {
      pendingHistoryRef.current = null;
    }
  }, [
    input,
    isStreaming,
    isReady,
    messages,
    setCompletion,
    complete,
    config,
    nodeData.contextLabel,
  ]);

  const clearChat = () => {
    setMessages([]);
    updateNodeData(id, { messages: [] });
  };

  return (
    <div
      className={`flex w-80 flex-col rounded-xl border bg-gray-900/95 shadow-lg ${
        selected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-gray-700'
      }`}
      style={{ maxHeight: 400 }}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-500 !w-2 !h-2" />

      <div className="flex items-center justify-between border-b border-gray-800 px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-blue-500/15 p-1 text-blue-300">
            <Bot className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-medium text-gray-300">AI Chat</span>
          <span className="text-[10px] text-gray-600">{PROVIDER_LABELS[config.provider]}</span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2" style={{ maxHeight: 280 }}>
        {messages.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-gray-600">Ask anything...</p>
        ) : (
          <div className="space-y-2">
            {messages.map((msg, i) => (
              <div
                key={`${msg.role}-${i}`}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-2.5 py-1.5 text-xs ${
                    msg.role === 'user'
                      ? 'rounded-br-sm bg-blue-600 text-white'
                      : 'rounded-bl-sm border border-gray-700 bg-gray-800 text-gray-200'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-invert prose-xs max-w-none break-words [&_p]:my-1">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )}
                  {isStreaming && i === messages.length - 1 && msg.role === 'assistant' && (
                    <span className="ml-0.5 inline-block h-2.5 w-0.5 animate-pulse rounded-sm bg-blue-300" />
                  )}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      <div className="border-t border-gray-800 p-2">
        <div className="flex items-end gap-1.5">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
            placeholder={isReady ? 'Ask something...' : 'Set API key in Reader'}
            className="flex-1 rounded-lg border border-gray-700 bg-gray-950 px-2.5 py-1.5 text-xs text-gray-100 placeholder:text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {isStreaming ? (
            <button
              onClick={() => {
                stop();
                pendingHistoryRef.current = null;
              }}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-500/40 bg-red-500/15 text-red-300"
            >
              <Square className="h-3 w-3" />
            </button>
          ) : (
            <button
              onClick={() => void sendMessage()}
              disabled={!input.trim() || !isReady}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white disabled:opacity-50"
            >
              <Send className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-gray-500 !w-2 !h-2" />
    </div>
  );
}

export const AIChatNode = memo(AIChatNodeComponent);
