import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';

import type { AIConfig } from './ai-vendor';

/**
 * Build a LanguageModel from an AIConfig, talking to any OpenAI-compatible
 * endpoint (formerly @saas-maker/ai's createAIModel).
 */
function createAIModel(
  config: AIConfig,
  options?: { headers?: Record<string, string>; name?: string }
): LanguageModel {
  const provider = createOpenAICompatible({
    baseURL: config.endpointUrl.trim().replace(/\/+$/, ''),
    apiKey: config.apiKey,
    name: options?.name ?? 'free-ai',
    headers: options?.headers,
  });
  return provider.chatModel(config.model);
}

/**
 * Default Workers AI text model. ~64 Neurons/inference. Routed through the
 * free-ai-gateway, which enforces a daily 9500-Neuron hard cap so we never
 * exceed the 10k/day free tier across the entire Fleet.
 */
const DEFAULT_WORKERS_AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

const FALLBACK_GATEWAY_BASE_URL = 'https://ai-gateway.sassmaker.com/v1';
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
  return (process.env.AI_GATEWAY_API_KEY ?? process.env.AI_API_KEY)?.trim() ?? '';
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
