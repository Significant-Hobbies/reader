import { NextResponse } from 'next/server';

import { normalizeApiKey, normalizeEndpointUrl } from '@/lib/ai-server';
import { fetchModels } from '@/lib/ai-vendor';
import { getAuthenticatedUserId } from '@/lib/auth-api';

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

    const models = await fetchModels(endpointUrl, apiKey);

    return NextResponse.json({
      models: models.map((id) => ({ id })),
      source: models.length > 0 ? 'live' : 'empty',
    });
  } catch (error) {
    console.error('AI model discovery failed:', error);
    return NextResponse.json({ models: [], source: 'error' });
  }
}
