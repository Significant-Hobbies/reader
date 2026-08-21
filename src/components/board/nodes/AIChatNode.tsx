'use client';

import { useCompletion } from '@ai-sdk/react';
import type { NodeProps } from '@xyflow/react';
import { Handle, NodeResizer, Position, useReactFlow } from '@xyflow/react';
import { Bot, Send, Square, Trash2 } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { AIConfig } from '../../../lib/ai-config';
import {
  AI_CONFIG_STORAGE_KEY,
  DEFAULT_AI_CONFIG,
  isLocalCLIEnabled,
} from '../../../lib/ai-config';
import type { AIChatMessage } from '../../../types';

type AIChatData = {
  messages: AIChatMessage[];
  contextLabel?: string;
  readOnly?: boolean;
  elementAnchor?: {
    articleId: string;
    websiteNodeId: string;
    elementIndex: number;
    tagName?: string;
    textPreview?: string;
  };
  onBrowseContent?: (articleId: string, websiteNodeId: string) => void;
};

const loadConfig = (): AIConfig => {
  if (typeof window === 'undefined') return DEFAULT_AI_CONFIG;
  try {
    const raw = window.localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_AI_CONFIG;
    const parsed = JSON.parse(raw) as Partial<AIConfig>;
    return {
      endpointUrl: typeof parsed.endpointUrl === 'string' ? parsed.endpointUrl.trim() : '',
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      model: typeof parsed.model === 'string' ? parsed.model.trim() : '',
    };
  } catch {
    return DEFAULT_AI_CONFIG;
  }
};

function ChatHeader({
  model,
  useLocalAI,
  hasMessages,
  readOnly,
  onClear,
}: {
  model: string;
  useLocalAI: boolean;
  hasMessages: boolean;
  readOnly?: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-b border-gray-800 px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="rounded-md bg-blue-500/15 p-1 text-blue-300">
          <Bot className="h-3.5 w-3.5" />
        </div>
        <span className="text-xs font-medium text-gray-300">AI Chat</span>
        {model && !useLocalAI && <span className="text-[10px] text-gray-600">{model}</span>}
        {useLocalAI && <span className="text-[10px] text-emerald-400">Local</span>}
      </div>
      {hasMessages && !readOnly && (
        <button
          onClick={onClear}
          className="rounded p-1 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function ChatAnchorButton({
  anchor,
  onBrowse,
}: {
  anchor: NonNullable<AIChatData['elementAnchor']>;
  onBrowse: (articleId: string, websiteNodeId: string) => void;
}) {
  return (
    <div className="border-b border-gray-800 px-3 py-1.5">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onBrowse(anchor.articleId, anchor.websiteNodeId);
        }}
        className="inline-flex max-w-full items-center gap-1 rounded-md bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-300 transition-colors hover:bg-blue-500/25"
      >
        <span className="font-mono">[{anchor.tagName || 'el'}]</span>
        <span className="truncate">&ldquo;{(anchor.textPreview || '').slice(0, 50)}&rdquo;</span>
      </button>
    </div>
  );
}

function ChatMessages({
  messages,
  isStreaming,
  chatEndRef,
}: {
  messages: AIChatMessage[];
  isStreaming: boolean;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto p-2">
        <p className="px-2 py-4 text-center text-xs text-gray-600">Ask anything...</p>
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto p-2">
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
    </div>
  );
}

function ChatInputBar({
  input,
  isReady,
  isStreaming,
  onInputChange,
  onSend,
  onStop,
}: {
  input: string;
  isReady: boolean;
  isStreaming: boolean;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
}) {
  return (
    <div className="border-t border-gray-800 p-2">
      <div className="flex items-end gap-1.5">
        <input
          type="text"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder={isReady ? 'Ask something...' : 'Configure AI in Reader settings'}
          className="flex-1 rounded-lg border border-gray-700 bg-gray-950 px-2.5 py-1.5 text-xs text-gray-100 placeholder:text-gray-600 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        />
        {isStreaming ? (
          <button
            onClick={onStop}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-500/40 bg-red-500/15 text-red-300"
          >
            <Square className="h-3 w-3" />
          </button>
        ) : (
          <button
            onClick={onSend}
            disabled={!input.trim() || !isReady}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white disabled:opacity-50"
          >
            <Send className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function buildSystemPrompt(contextLabel: string | undefined): string {
  return [
    'You are an AI assistant on an infinite canvas board.',
    'Keep responses concise and helpful.',
    contextLabel ? `Context: ${contextLabel}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function useChatCompletion(
  id: string,
  pendingHistoryRef: React.RefObject<AIChatMessage[] | null>,
  setMessages: React.Dispatch<React.SetStateAction<AIChatMessage[]>>,
  updateNodeData: (id: string, data: Record<string, unknown>) => void
) {
  return useCompletion({
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
}

function useAIChatNode(id: string, nodeData: AIChatData) {
  const { updateNodeData } = useReactFlow();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AIChatMessage[]>(nodeData.messages || []);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pendingHistoryRef = useRef<AIChatMessage[] | null>(null);

  const config = useMemo(() => loadConfig(), []);
  const useLocalAI = useMemo(
    () => isLocalCLIEnabled() && !config.endpointUrl,
    [config.endpointUrl]
  );

  const isReady = useMemo(() => {
    if (useLocalAI) return true;
    return Boolean(config.endpointUrl.trim() && config.model.trim());
  }, [config.endpointUrl, config.model, useLocalAI]);

  const {
    completion,
    complete,
    stop,
    setCompletion,
    isLoading: isStreaming,
  } = useChatCompletion(id, pendingHistoryRef, setMessages, updateNodeData);

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

    try {
      await complete(userMessage, {
        body: {
          endpointUrl: useLocalAI ? undefined : config.endpointUrl,
          model: config.model,
          apiKey: useLocalAI ? undefined : config.apiKey,
          local: useLocalAI || undefined,
          messages: nextHistory,
          systemPrompt: buildSystemPrompt(nodeData.contextLabel),
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
    useLocalAI,
    nodeData.contextLabel,
  ]);

  const clearChat = () => {
    setMessages([]);
    updateNodeData(id, { messages: [] });
  };

  const stopStreaming = () => {
    stop();
    pendingHistoryRef.current = null;
  };

  return {
    input,
    setInput,
    messages,
    isStreaming,
    isReady,
    config,
    useLocalAI,
    chatEndRef,
    sendMessage,
    clearChat,
    stopStreaming,
  };
}

function AIChatNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as AIChatData;
  const {
    input,
    setInput,
    messages,
    isStreaming,
    isReady,
    config,
    useLocalAI,
    chatEndRef,
    sendMessage,
    clearChat,
    stopStreaming,
  } = useAIChatNode(id, nodeData);

  return (
    <div
      className={`flex min-w-[16rem] flex-col rounded-xl border bg-gray-900/95 shadow-lg ${
        selected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-gray-700'
      }`}
      style={{ width: '100%', height: '100%', minHeight: 200 }}
    >
      <NodeResizer
        isVisible={!!selected}
        minWidth={260}
        minHeight={200}
        lineClassName="!border-blue-500"
        handleClassName="!w-2 !h-2 !bg-blue-500 !border-blue-500"
      />
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-gray-500" />

      <ChatHeader
        model={config.model}
        useLocalAI={useLocalAI}
        hasMessages={messages.length > 0}
        readOnly={nodeData.readOnly}
        onClear={clearChat}
      />

      {nodeData.elementAnchor && nodeData.onBrowseContent && (
        <ChatAnchorButton anchor={nodeData.elementAnchor} onBrowse={nodeData.onBrowseContent} />
      )}

      <ChatMessages messages={messages} isStreaming={isStreaming} chatEndRef={chatEndRef} />

      {!nodeData.readOnly && (
        <ChatInputBar
          input={input}
          isReady={isReady}
          isStreaming={isStreaming}
          onInputChange={setInput}
          onSend={() => void sendMessage()}
          onStop={stopStreaming}
        />
      )}

      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-gray-500" />
    </div>
  );
}

export const AIChatNode = memo(AIChatNodeComponent);
