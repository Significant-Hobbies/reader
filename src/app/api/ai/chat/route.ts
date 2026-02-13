import { NextResponse } from 'next/server';
import { streamText } from 'ai';
import { getAuthenticatedUserId } from '@/lib/auth-api';
import {
  getDefaultModelForProvider,
  isLocalCLIEnabled,
  isLocalAIProvider,
  normalizeAIProvider,
} from '@/lib/ai-config';
import {
  createLanguageModel,
  createLocalBridgeTextStream,
  DEFAULT_SYSTEM_PROMPT,
  MAX_SYSTEM_PROMPT_LENGTH,
  normalizeApiKey,
  normalizeChatMessages,
  normalizeText,
  requiresApiKey,
  TEXT_STREAM_HEADERS,
  toSDKMessages,
} from '@/lib/ai-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    provider?: unknown;
    model?: unknown;
    apiKey?: unknown;
    systemPrompt?: unknown;
    messages?: unknown;
  };

  const provider = normalizeAIProvider(body.provider);
  const model = normalizeText(body.model, 180) || getDefaultModelForProvider(provider);
  const apiKey = normalizeApiKey(body.apiKey);
  const systemPrompt =
    normalizeText(body.systemPrompt, MAX_SYSTEM_PROMPT_LENGTH) || DEFAULT_SYSTEM_PROMPT;
  const messages = normalizeChatMessages(body.messages);

  if (messages.length === 0) {
    return NextResponse.json({ error: 'At least one message is required' }, { status: 400 });
  }

  if (isLocalAIProvider(provider) && !isLocalCLIEnabled()) {
    return NextResponse.json(
      {
        error: 'Local CLI providers are available only in development environments.',
      },
      { status: 400 }
    );
  }

  if (requiresApiKey(provider) && !apiKey) {
    return NextResponse.json({ error: `API key is required for ${provider}` }, { status: 400 });
  }

  try {
    if (isLocalAIProvider(provider)) {
      const stream = await createLocalBridgeTextStream({
        localProvider: provider,
        model,
        messages,
        systemPrompt,
      });

      return new NextResponse(stream, {
        headers: TEXT_STREAM_HEADERS,
      });
    }

    const result = streamText({
      model: createLanguageModel(provider, model, apiKey),
      system: systemPrompt,
      messages: toSDKMessages(messages),
      maxRetries: 0,
    });

    return result.toTextStreamResponse({
      headers: TEXT_STREAM_HEADERS,
    });
  } catch (error) {
    console.error('AI chat request failed:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to stream AI response',
      },
      { status: 500 }
    );
  }
}
