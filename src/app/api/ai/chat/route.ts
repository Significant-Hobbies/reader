import { streamText } from 'ai';
import { NextResponse } from 'next/server';

import { getLanguageModel } from '@/lib/ai-cloudflare';
import { isLocalCLIEnabled } from '@/lib/ai-config';
import {
  createLocalAITextStream,
  DEFAULT_SYSTEM_PROMPT,
  MAX_SYSTEM_PROMPT_LENGTH,
  normalizeApiKey,
  normalizeChatMessages,
  normalizeEndpointUrl,
  normalizeText,
  TEXT_STREAM_HEADERS,
  toSDKMessages,
} from '@/lib/ai-server';
import { getAuthenticatedUserId } from '@/lib/auth-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    endpointUrl?: unknown;
    model?: unknown;
    apiKey?: unknown;
    systemPrompt?: unknown;
    messages?: unknown;
    local?: unknown;
  };

  const endpointUrl = normalizeEndpointUrl(body.endpointUrl);
  const model = normalizeText(body.model, 180);
  const apiKey = normalizeApiKey(body.apiKey);
  const systemPrompt =
    normalizeText(body.systemPrompt, MAX_SYSTEM_PROMPT_LENGTH) || DEFAULT_SYSTEM_PROMPT;
  const messages = normalizeChatMessages(body.messages);
  const isLocal = body.local === true;

  if (messages.length === 0) {
    return NextResponse.json({ error: 'At least one message is required' }, { status: 400 });
  }

  if (isLocal) {
    if (!isLocalCLIEnabled()) {
      return NextResponse.json(
        { error: 'Local AI is available only in development environments.' },
        { status: 400 }
      );
    }

    try {
      const stream = await createLocalAITextStream({ model, messages, systemPrompt });
      return new NextResponse(stream, { headers: TEXT_STREAM_HEADERS });
    } catch (error) {
      console.error('Local AI chat request failed:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to stream local AI response' },
        { status: 500 }
      );
    }
  }

  if (!model) {
    return NextResponse.json({ error: 'Model is required' }, { status: 400 });
  }

  // endpointUrl/apiKey are optional when the Workers AI binding is present —
  // getLanguageModel falls back to env.AI automatically.

  try {
    const result = streamText({
      model: getLanguageModel({
        endpointUrl,
        apiKey,
        model,
        headers: { 'x-gateway-project-id': 'reader' },
      }),
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
