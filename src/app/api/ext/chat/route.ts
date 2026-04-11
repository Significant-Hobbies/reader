import { NextResponse } from 'next/server';
import { streamText } from 'ai';
import {
  createLanguageModel,
  DEFAULT_SYSTEM_PROMPT,
  normalizeChatMessages,
  normalizeText,
  TEXT_STREAM_HEADERS,
  toSDKMessages,
} from '@/lib/ai-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EXT_MAX_MESSAGES = 6;
const EXT_MAX_SYSTEM_PROMPT_LENGTH = 2_000;
const DAILY_LIMIT = 10;

const rateLimitMap = new Map<string, { count: number; resetDate: string }>();

function getClientIP(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const today = getTodayDate();
  const entry = rateLimitMap.get(ip);

  if (!entry || entry.resetDate !== today) {
    rateLimitMap.set(ip, { count: 1, resetDate: today });
    return { allowed: true, remaining: DAILY_LIMIT - 1 };
  }

  if (entry.count >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  entry.count += 1;
  return { allowed: true, remaining: DAILY_LIMIT - entry.count };
}

export async function POST(request: Request) {
  const ip = getClientIP(request);
  const { allowed, remaining } = checkRateLimit(ip);

  if (!allowed) {
    return NextResponse.json(
      { error: 'Daily chat limit reached. Please try again tomorrow.' },
      {
        status: 429,
        headers: { 'Retry-After': '86400' },
      }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    systemPrompt?: unknown;
    messages?: unknown;
  };

  const systemPrompt =
    normalizeText(body.systemPrompt, EXT_MAX_SYSTEM_PROMPT_LENGTH) || DEFAULT_SYSTEM_PROMPT;
  const messages = normalizeChatMessages(body.messages).slice(-EXT_MAX_MESSAGES);

  if (messages.length === 0) {
    return NextResponse.json({ error: 'At least one message is required' }, { status: 400 });
  }

  const apiKey = process.env.AI_GATEWAY_API_KEY || '';
  const gatewayUrl = process.env.AI_GATEWAY_URL || 'https://gateway.vercel.ai/v1';

  try {
    const result = streamText({
      model: createLanguageModel({
        endpointUrl: gatewayUrl,
        apiKey,
        model: 'openai/gpt-4.1-mini',
      }),
      system: systemPrompt,
      messages: toSDKMessages(messages),
      maxRetries: 0,
      headers: { 'x-gateway-project-id': 'reader' },
    });

    return result.toTextStreamResponse({
      headers: {
        ...TEXT_STREAM_HEADERS,
        'X-RateLimit-Remaining': String(remaining),
      },
    });
  } catch (error) {
    console.error('Extension chat request failed:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to stream AI response',
      },
      { status: 500 }
    );
  }
}
