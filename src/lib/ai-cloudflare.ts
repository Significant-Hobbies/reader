import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { AIConfig } from '@saas-maker/ai/server';
import { createAIModel } from '@saas-maker/ai/server';
import type { LanguageModel } from 'ai';
import { createWorkersAI } from 'workers-ai-provider';

/**
 * Default Workers AI text model. ~64 Neurons/inference.
 * 10k Neurons/day free quota → ~150 inferences/day before overage.
 */
const DEFAULT_WORKERS_AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

/** Default Workers AI embedding model — 768 dims, ~0.5 Neurons/call. */
export const DEFAULT_WORKERS_AI_EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';

interface CreateLanguageModelArgs {
  endpointUrl: string;
  apiKey: string;
  model: string;
  headers?: Record<string, string>;
}

/**
 * Returns a LanguageModel that uses the Cloudflare Workers AI binding when
 * available, falling back to the user-configured external OpenAI-compatible
 * endpoint (e.g. Vercel AI Gateway).
 *
 * Selection order:
 *   1. User supplied endpointUrl + apiKey → external provider (BYO key)
 *   2. env.AI binding present             → Workers AI (free tier)
 *   3. External provider regardless       → preserve existing error surface
 */
export function getLanguageModel({
  endpointUrl,
  apiKey,
  model,
  headers,
}: CreateLanguageModelArgs): LanguageModel {
  // Honour explicit BYO config first.
  if (endpointUrl && apiKey) {
    return createAIModel({ endpointUrl, apiKey, model } as AIConfig, { headers });
  }

  const ai = getWorkersAIBinding();
  if (ai) {
    const workersai = createWorkersAI({ binding: ai });
    const modelId = model?.startsWith('@cf/') ? model : DEFAULT_WORKERS_AI_MODEL;
    return workersai(modelId as Parameters<typeof workersai>[0]);
  }

  // Fall back to whatever endpoint config we got — preserves existing error
  // messages when the user has not configured anything.
  return createAIModel({ endpointUrl, apiKey, model } as AIConfig, { headers });
}

/**
 * Generate embeddings via the Workers AI binding when present. Returns null
 * when the binding is not available, letting the caller decide whether to
 * fall back to a different provider.
 *
 * Uses `@cf/baai/bge-base-en-v1.5` (768 dims) which is also the model the
 * `reader-articles` Vectorize index is provisioned for.
 */
export async function embedTextsWithWorkersAI(
  texts: string[],
  modelId: string = DEFAULT_WORKERS_AI_EMBEDDING_MODEL
): Promise<number[][] | null> {
  const ai = getWorkersAIBinding();
  if (!ai) return null;

  const result = (await ai.run(modelId, { text: texts })) as {
    data?: number[][];
  };
  return result.data ?? null;
}

interface AiBinding {
  run(model: string, inputs: unknown, options?: unknown): Promise<unknown>;
}

function getWorkersAIBinding(): AiBinding | null {
  try {
    const { env } = getCloudflareContext();
    const ai = (env as unknown as { AI?: AiBinding }).AI;
    return ai ?? null;
  } catch {
    // getCloudflareContext throws outside the Workers runtime.
    return null;
  }
}
