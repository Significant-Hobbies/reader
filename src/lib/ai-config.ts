import type { AIChatMessage as SharedAIChatMessage } from '../types';

export type AIChatMessage = SharedAIChatMessage;

// Re-export from the local vendored AI helpers (formerly @saas-maker/ai),
// used with the project's custom storage key.
export type { AIConfig } from './ai-vendor';

export const AI_CONFIG_STORAGE_KEY = 'web-annotator-ai-config-v2';

export const DEFAULT_AI_CONFIG = { endpointUrl: '', apiKey: '', model: '' };

export const isLocalCLIEnabled = () => process.env.NODE_ENV === 'development';
