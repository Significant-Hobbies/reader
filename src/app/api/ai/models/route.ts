import { NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '@/lib/auth-api';
import {
  AIModelOption,
  AIProvider,
  DEFAULT_AI_CONFIG,
  FALLBACK_MODELS,
  isLikelyStableModelId,
  isLocalCLIEnabled,
  isLocalAIProvider,
  normalizeAIProvider,
  prioritizeStableModelIds,
} from '@/lib/ai-config';
import { listLiveModels, normalizeApiKey } from '@/lib/ai-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ModelsPayload = {
  models: AIModelOption[];
  source: 'live' | 'fallback';
  error?: string;
};

const toModelOptions = (
  provider: AIProvider,
  ids: string[],
  source: 'live' | 'fallback'
): AIModelOption[] =>
  prioritizeStableModelIds(ids).map((id) => ({
    id,
    name: id,
    provider,
    source,
    isStable: isLikelyStableModelId(id),
  }));

const fallbackModels = (provider: AIProvider, error?: string): ModelsPayload => ({
  models: toModelOptions(provider, FALLBACK_MODELS[provider] ?? [], 'fallback'),
  source: 'fallback',
  error,
});

export async function POST(request: Request) {
  let provider: AIProvider = 'gateway';

  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      provider?: unknown;
      apiKey?: unknown;
    };

    provider = normalizeAIProvider(body.provider);
    const apiKey = normalizeApiKey(body.apiKey);

    if (isLocalAIProvider(provider)) {
      if (!isLocalCLIEnabled()) {
        return NextResponse.json(
          fallbackModels(
            DEFAULT_AI_CONFIG.provider,
            'Local CLI providers are available only in development environments.'
          ),
          { status: 400 }
        );
      }
      return NextResponse.json(fallbackModels(provider));
    }

    if (provider !== 'gateway') {
      return NextResponse.json(
        fallbackModels(
          provider,
          'Live model discovery is currently available via Vercel AI Gateway only.'
        )
      );
    }

    const modelIds = await listLiveModels(provider, apiKey);
    if (modelIds.length === 0) {
      return NextResponse.json(
        fallbackModels(provider, 'No models returned from provider catalog.')
      );
    }

    return NextResponse.json({
      models: toModelOptions(provider, modelIds, 'live'),
      source: 'live',
    } satisfies ModelsPayload);
  } catch (error) {
    console.error('AI model discovery failed:', error);

    return NextResponse.json(
      fallbackModels(provider, error instanceof Error ? error.message : 'Failed to fetch models')
    );
  }
}
