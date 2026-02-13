import type { AIChatMessage as SharedAIChatMessage } from '../types';

export type AIProvider =
  | 'gateway'
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'claude-code'
  | 'codex'
  | 'gemini-cli';

export type AIChatMessage = SharedAIChatMessage;

export interface AIConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
}

export interface AIModelOption {
  id: string;
  name: string;
  provider: AIProvider | 'mixed';
  source: 'live' | 'fallback';
  isStable: boolean;
}

const ALL_AI_PROVIDERS: AIProvider[] = [
  'gateway',
  'openai',
  'anthropic',
  'google',
  'claude-code',
  'codex',
  'gemini-cli',
];

export const PROVIDER_LABELS: Record<AIProvider, string> = {
  gateway: 'Vercel AI Gateway',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google Gemini',
  'claude-code': 'Claude Code CLI',
  codex: 'Codex CLI',
  'gemini-cli': 'Gemini CLI',
};

export const LOCAL_AI_PROVIDERS = new Set<AIProvider>(['claude-code', 'codex', 'gemini-cli']);

export const LOCAL_TOOL_BY_PROVIDER = {
  'claude-code': 'claude',
  codex: 'codex',
  'gemini-cli': 'gemini',
} as const;

export type LocalCLIProvider = keyof typeof LOCAL_TOOL_BY_PROVIDER;

export const FALLBACK_MODELS: Record<AIProvider, string[]> = {
  gateway: ['openai/gpt-4.1-mini', 'anthropic/claude-sonnet-4-5', 'google/gemini-2.5-flash'],
  openai: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini', 'o4-mini'],
  anthropic: ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001', 'claude-opus-4-6'],
  google: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3-pro-preview'],
  'claude-code': ['claude-code-local'],
  codex: ['codex-local'],
  'gemini-cli': ['gemini-cli-local'],
};

export const DEFAULT_AI_CONFIG: AIConfig = {
  provider: 'gateway',
  model: FALLBACK_MODELS.gateway[0],
  apiKey: '',
};

export const AI_CONFIG_STORAGE_KEY = 'web-annotator-ai-config-v1';

const UNSTABLE_MODEL_TOKENS = ['preview', 'beta', 'alpha', 'experimental', 'exp', 'nightly', 'dev'];

export const isAIProvider = (value: unknown): value is AIProvider =>
  typeof value === 'string' && ALL_AI_PROVIDERS.includes(value as AIProvider);

export const isLocalAIProvider = (provider: AIProvider): provider is LocalCLIProvider =>
  LOCAL_AI_PROVIDERS.has(provider);

export const normalizeAIProvider = (value: unknown): AIProvider =>
  isAIProvider(value) ? value : DEFAULT_AI_CONFIG.provider;

export const isLocalCLIEnabled = () => process.env.NODE_ENV === 'development';

export const normalizeAvailableAIProvider = (value: unknown, allowLocalProviders: boolean) => {
  const provider = normalizeAIProvider(value);
  if (!allowLocalProviders && isLocalAIProvider(provider)) {
    return DEFAULT_AI_CONFIG.provider;
  }
  return provider;
};

export const getDefaultModelForProvider = (provider: AIProvider) =>
  FALLBACK_MODELS[provider][0] ?? FALLBACK_MODELS.gateway[0];

export const toProviderLabel = (provider: AIProvider) => PROVIDER_LABELS[provider] ?? provider;

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
