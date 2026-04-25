export interface PageContent {
  title: string;
  byline: string | null;
  content: string;
  textContent: string;
  siteName: string | null;
  url: string;
}

export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type AIProvider = 'gateway' | 'openai' | 'anthropic' | 'google';

export interface AIConfig {
  provider: AIProvider;
  model: string;
  apiKey: string;
}

export const PROVIDER_LABELS: Record<AIProvider, string> = {
  gateway: 'Vercel AI Gateway',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google Gemini',
};

export const FALLBACK_MODELS: Record<AIProvider, string[]> = {
  gateway: ['openai/gpt-4.1-mini', 'anthropic/claude-sonnet-4-5', 'google/gemini-2.5-flash'],
  openai: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini', 'o4-mini'],
  anthropic: ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001', 'claude-opus-4-6'],
  google: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3-pro-preview'],
};

export const DEFAULT_AI_CONFIG: AIConfig = {
  provider: 'gateway',
  model: FALLBACK_MODELS.gateway[0],
  apiKey: '',
};

export const AI_CONFIG_STORAGE_KEY = 'web-annotator-ai-config-v1';

export interface AuthUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
}
