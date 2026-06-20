import type { AIChatMessage as SharedAIChatMessage } from '../types';

export type AIChatMessage = SharedAIChatMessage;

// Re-export from the local vendored AI helpers (formerly @saas-maker/ai),
// used with the project's custom storage key.
export type { AIConfig } from './ai-vendor';
export { getAIConfig, saveAIConfig } from './ai-vendor';

export const AI_CONFIG_STORAGE_KEY = 'web-annotator-ai-config-v2';

export const DEFAULT_AI_CONFIG = { endpointUrl: '', apiKey: '', model: '' };

export const isLocalCLIEnabled = () => process.env.NODE_ENV === 'development';

const UNSTABLE_MODEL_TOKENS = ['preview', 'beta', 'alpha', 'experimental', 'exp', 'nightly', 'dev'];

export const isLikelyStableModelId = (modelId: string) => {
  const lower = modelId.toLowerCase();
  return !UNSTABLE_MODEL_TOKENS.some((token) => lower.includes(token));
};

export const prioritizeStableModelIds = (ids: string[]): string[] => {
  const unique = Array.from(new Set(ids.map((id) => id.trim()).filter((id) => id.length > 0)));

  return unique.sort((a, b) => {
    const stableA = isLikelyStableModelId(a);
    const stableB = isLikelyStableModelId(b);
    if (stableA !== stableB) return stableA ? -1 : 1;
    return a.localeCompare(b);
  });
};
