import { NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth-api';
import { prioritizeStableModelIds } from '@/lib/ai-config';
import { normalizeApiKey, normalizeEndpointUrl } from '@/lib/ai-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      endpointUrl?: unknown;
      apiKey?: unknown;
    };

    const endpointUrl = normalizeEndpointUrl(body.endpointUrl);
    const apiKey = normalizeApiKey(body.apiKey);

    if (!endpointUrl) {
      return NextResponse.json({ models: [], source: 'empty' });
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${endpointUrl}/models`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      console.error(`Model fetch failed: ${response.status}`);
      return NextResponse.json({ models: [], source: 'error' });
    }

    const payload = (await response.json().catch(() => ({}))) as {
      data?: Array<{ id?: string }>;
    };

    const ids = Array.isArray(payload.data)
      ? payload.data
          .map((m) => (typeof m?.id === 'string' ? m.id.trim() : ''))
          .filter((id) => id.length > 0)
      : [];

    return NextResponse.json({
      models: prioritizeStableModelIds(ids).map((id) => ({ id })),
      source: ids.length > 0 ? 'live' : 'empty',
    });
  } catch (error) {
    console.error('AI model discovery failed:', error);
    return NextResponse.json({ models: [], source: 'error' });
  }
}
