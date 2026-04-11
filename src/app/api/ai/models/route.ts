import { NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth-api';
import { handleModelsRequest } from '@saas-maker/ai/server';
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

    const result = await handleModelsRequest({ endpointUrl, apiKey });

    return NextResponse.json({
      models: result.models.map((id) => ({ id })),
      source: result.models.length > 0 ? 'live' : 'empty',
    });
  } catch (error) {
    console.error('AI model discovery failed:', error);
    return NextResponse.json({ models: [], source: 'error' });
  }
}
