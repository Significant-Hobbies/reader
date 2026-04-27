import type { AIConfig } from '@saas-maker/ai/server';
import { createAIModel } from '@saas-maker/ai/server';
import type { LanguageModel } from 'ai';

/**
 * Default Workers AI text model. ~64 Neurons/inference. Routed through the
 * free-ai-gateway, which enforces a daily 9500-Neuron hard cap so we never
 * exceed the 10k/day free tier across the entire Fleet.
 */
const DEFAULT_WORKERS_AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

/** Default Workers AI embedding model — 768 dims, ~0.5 Neurons/call. */
export const DEFAULT_WORKERS_AI_EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';

const FALLBACK_GATEWAY_BASE_URL = 'https://free-ai-gateway.sarthakagrawal927.workers.dev/v1';
const PROJECT_ID = 'reader';

interface CreateLanguageModelArgs {
  endpointUrl: string;
  apiKey: string;
  model: string;
  headers?: Record<string, string>;
}

function getGatewayBaseUrl(): string {
  const fromEnv = process.env.AI_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  return FALLBACK_GATEWAY_BASE_URL;
}

function getGatewayApiKey(): string {
  return process.env.AI_API_KEY?.trim() ?? '';
}

/**
 * Returns a LanguageModel that talks to free-ai-gateway by default. The
 * gateway is the single Workers AI chokepoint for the entire Fleet — it owns
 * the daily Neuron budget. Users can still BYO an external provider by
 * supplying both `endpointUrl` and `apiKey`.
 */
export function getLanguageModel({
  endpointUrl,
  apiKey,
  model,
  headers,
}: CreateLanguageModelArgs): LanguageModel {
  // Honour explicit BYO config first (settings UI etc.).
  if (endpointUrl && apiKey) {
    return createAIModel({ endpointUrl, apiKey, model } as AIConfig, { headers });
  }

  const gatewayBaseUrl = getGatewayBaseUrl();
  const gatewayApiKey = getGatewayApiKey();
  const resolvedModel = model || DEFAULT_WORKERS_AI_MODEL;

  return createAIModel(
    {
      endpointUrl: gatewayBaseUrl,
      // free-ai-gateway tolerates an empty key; pass a placeholder so the
      // OpenAI-compatible client still attaches a Bearer header (some
      // intermediaries strip empty Authorization values).
      apiKey: gatewayApiKey || 'free-ai-gateway',
      model: resolvedModel,
    } as AIConfig,
    {
      headers: {
        'x-gateway-project-id': PROJECT_ID,
        ...headers,
      },
    }
  );
}

/**
 * Generate embeddings via the free-ai-gateway `/v1/embeddings` endpoint
 * (OpenAI-compatible). Returns null on failure so callers can fall back.
 */
export async function embedTextsWithWorkersAI(
  texts: string[],
  modelId: string = DEFAULT_WORKERS_AI_EMBEDDING_MODEL
): Promise<number[][] | null> {
  if (texts.length === 0) return [];

  try {
    const response = await fetch(`${getGatewayBaseUrl()}/embeddings`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${getGatewayApiKey() || 'free-ai-gateway'}`,
        'x-gateway-project-id': PROJECT_ID,
      },
      body: JSON.stringify({
        model: modelId,
        input: texts,
        project_id: PROJECT_ID,
      }),
    });

    if (!response.ok) return null;

    const json = (await response.json()) as {
      data?: Array<{ embedding?: number[] }>;
    };
    const rows = (json.data ?? [])
      .map((item) => item.embedding)
      .filter((row): row is number[] => Array.isArray(row));
    return rows.length > 0 ? rows : null;
  } catch {
    return null;
  }
}
