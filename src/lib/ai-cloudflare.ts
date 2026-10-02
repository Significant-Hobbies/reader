import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { createWorkersAI, type WorkersAISettings } from 'workers-ai-provider';

import type { AIConfig } from './ai-vendor';
import { createBudgetedWorkersAiBinding, type SharedBudgetNamespace } from './shared-ai-budget';

type WorkersAiBinding = Extract<WorkersAISettings, { binding: unknown }>['binding'];
type FreeAiBinding = { fetch(request: Request): Promise<Response> };

/**
 * Build a LanguageModel from an AIConfig, talking to any OpenAI-compatible
 * endpoint (formerly @saas-maker/ai's createAIModel).
 */
function createAIModel(
  config: AIConfig,
  options?: {
    headers?: Record<string, string>;
    name?: string;
    fetch?: typeof fetch;
    supportsStructuredOutputs?: boolean;
  }
): LanguageModel {
  const provider = createOpenAICompatible({
    baseURL: config.endpointUrl.trim().replace(/\/+$/, ''),
    apiKey: config.apiKey,
    name: options?.name ?? 'reader-direct',
    headers: options?.headers,
    ...(options?.fetch ? { fetch: options.fetch } : {}),
    ...(options?.supportsStructuredOutputs !== undefined
      ? { supportsStructuredOutputs: options.supportsStructuredOutputs }
      : {}),
  });
  return provider.chatModel(config.model);
}

/** Default model when the project's direct endpoint is Workers AI. */
const DEFAULT_WORKERS_AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

interface CreateLanguageModelArgs<Id = never> {
  binding?: WorkersAiBinding;
  freeAiBinding?: FreeAiBinding;
  nodeEnv?: string;
  endpointUrl: string;
  apiKey: string;
  model: string;
  headers?: Record<string, string>;
  budgetNamespace?: SharedBudgetNamespace<Id>;
}

function getDirectBaseUrl(): string {
  const fromEnv = process.env.AI_BASE_URL?.trim();
  if (!fromEnv) throw new Error('AI_BASE_URL is required when no BYOK endpoint is supplied');
  return fromEnv.replace(/\/+$/, '');
}

function getDirectApiKey(): string {
  const apiKey = process.env.AI_API_KEY?.trim();
  if (!apiKey) throw new Error('AI_API_KEY is required when no BYOK key is supplied');
  return apiKey;
}

function createFreeAiGatewayModel(
  freeAiBinding: FreeAiBinding,
  headers?: Record<string, string>
): LanguageModel {
  return createAIModel(
    { endpointUrl: 'https://fleet-gateway.internal/v1', apiKey: 'service-binding', model: 'auto' },
    {
      name: 'free-ai',
      headers: { ...headers, 'x-gateway-project-id': 'reader' },
      fetch: (input, init) => freeAiBinding.fetch(new Request(input, init)),
      supportsStructuredOutputs: false,
    }
  );
}

/**
 * Returns a model for an explicit BYOK endpoint or the project's own direct
 * free-provider/local endpoint. No shared gateway fallback exists.
 */
export function getLanguageModel<Id = never>({
  binding,
  endpointUrl,
  apiKey,
  model,
  headers,
  budgetNamespace,
  freeAiBinding,
  nodeEnv,
}: CreateLanguageModelArgs<Id>): LanguageModel {
  // Honour explicit BYO config first (settings UI etc.).
  if (endpointUrl && apiKey) {
    return createAIModel({ endpointUrl, apiKey, model } as AIConfig, { headers });
  }

  if (freeAiBinding) {
    return createFreeAiGatewayModel(freeAiBinding, headers);
  }
  if ((nodeEnv ?? process.env.NODE_ENV) === 'production') {
    throw new Error('Free AI gateway service binding is required in production');
  }

  if (binding) {
    return createWorkersAI({
      binding: createBudgetedWorkersAiBinding(binding, budgetNamespace),
    })(model || DEFAULT_WORKERS_AI_MODEL);
  }

  const resolvedModel = model || DEFAULT_WORKERS_AI_MODEL;

  return createAIModel(
    {
      endpointUrl: getDirectBaseUrl(),
      apiKey: getDirectApiKey(),
      model: resolvedModel,
    } as AIConfig,
    { headers }
  );
}
