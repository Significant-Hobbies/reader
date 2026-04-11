import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createParser } from 'eventsource-parser';
import type { AIChatMessage } from './ai-config';

export const MAX_API_KEY_LENGTH = 512;
export const MAX_CHAT_MESSAGES = 24;
export const MAX_CHAT_MESSAGE_LENGTH = 10_000;
export const MAX_SYSTEM_PROMPT_LENGTH = 8_000;

export const DEFAULT_SYSTEM_PROMPT =
  'You are an AI reading assistant helping users understand saved web articles and notes.';

export const TEXT_STREAM_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  'X-Accel-Buffering': 'no',
} as const;

export const normalizeText = (value: unknown, maxLength: number) =>
  String(value ?? '')
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, maxLength);

export const normalizeApiKey = (value: unknown) =>
  typeof value === 'string' ? value.trim().slice(0, MAX_API_KEY_LENGTH) : '';

export const normalizeEndpointUrl = (value: unknown) =>
  typeof value === 'string' ? value.trim().replace(/\/+$/, '').slice(0, 512) : '';

export const normalizeChatMessages = (payload: unknown): AIChatMessage[] => {
  if (!Array.isArray(payload)) return [];

  return payload
    .map((message) => {
      if (typeof message !== 'object' || message === null) return null;
      const record = message as { role?: unknown; content?: unknown };
      if (record.role !== 'user' && record.role !== 'assistant') return null;

      const content = normalizeText(record.content, MAX_CHAT_MESSAGE_LENGTH);
      if (!content) return null;

      return {
        role: record.role,
        content,
      } as AIChatMessage;
    })
    .filter((message): message is AIChatMessage => Boolean(message))
    .slice(-MAX_CHAT_MESSAGES);
};

export const toSDKMessages = (messages: AIChatMessage[]) =>
  messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));

export const parseResponseError = async (response: Response) => {
  const raw = await response.text().catch(() => '');
  if (!raw) return `Provider returned ${response.status}`;
  return `Provider returned ${response.status}: ${raw.slice(0, 400)}`;
};

export const createLanguageModel = ({
  endpointUrl,
  apiKey,
  model,
}: {
  endpointUrl: string;
  apiKey: string;
  model: string;
}) => {
  const provider = createOpenAICompatible({
    baseURL: endpointUrl,
    apiKey,
    name: 'custom',
  });
  return provider(model);
};

export const createLocalAITextStream = async ({
  model,
  messages,
  systemPrompt,
}: {
  model: string;
  messages: AIChatMessage[];
  systemPrompt: string;
}) => {
  const localAiBase = (
    process.env.LOCAL_AI_URL ||
    process.env.CLI_BRIDGE_URL ||
    'http://127.0.0.1:3456'
  ).replace(/\/$/, '');

  const response = await fetch(`${localAiBase}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model || undefined,
      messages,
      systemPrompt,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(await parseResponseError(response));
  }

  if (!response.body) {
    return new ReadableStream<Uint8Array>();
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let streamError: Error | null = null;

      const parser = createParser({
        onEvent: (event) => {
          if (event.data === '[DONE]') return;

          try {
            const payload = JSON.parse(event.data) as { text?: string; error?: string };
            if (payload.error) {
              streamError = new Error(payload.error);
              return;
            }

            if (payload.text) {
              controller.enqueue(encoder.encode(payload.text));
            }
          } catch {
            // Ignore malformed local chunks.
          }
        },
      });

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          parser.feed(decoder.decode(value, { stream: true }));
          if (streamError) throw streamError;
        }
      } catch (error) {
        controller.error(
          error instanceof Error ? error : new Error('Failed to parse local stream')
        );
        return;
      }

      if (streamError) {
        controller.error(streamError);
        return;
      }

      controller.close();
    },
    cancel: async () => {
      await reader.cancel();
    },
  });
};
