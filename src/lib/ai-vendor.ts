// Local vendored AI helpers (formerly @saas-maker/ai). Universal (no React) so
// it is safe to import from both server routes and client code. Talks to any
// OpenAI-compatible endpoint — the Fleet default is the free-ai gateway.

export interface AIConfig {
  endpointUrl: string;
  apiKey: string;
  model: string;
}

const DEFAULT_CONFIG: AIConfig = { endpointUrl: '', apiKey: '', model: '' };

function normalize(config: AIConfig): AIConfig {
  return {
    endpointUrl: config.endpointUrl.trim().replace(/\/+$/, ''),
    apiKey: config.apiKey.trim(),
    model: config.model.trim(),
  };
}

export function getAIConfig(storageKey = 'ai-config'): AIConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) return normalize(JSON.parse(raw) as AIConfig);
  } catch {
    // ignore malformed stored config
  }
  return DEFAULT_CONFIG;
}

export function saveAIConfig(config: AIConfig, storageKey = 'ai-config'): void {
  localStorage.setItem(storageKey, JSON.stringify(normalize(config)));
}

/**
 * Fetch available models from an OpenAI-compatible endpoint.
 * Tries /models then /v1/models. Works in any runtime (Node, Workers, browser).
 */
export async function fetchModels(endpointUrl: string, apiKey: string): Promise<string[]> {
  const base = endpointUrl.trim().replace(/\/+$/, '');
  if (!base) return [];
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  for (const path of ['/models', '/v1/models']) {
    try {
      const res = await fetch(`${base}${path}`, { method: 'GET', headers });
      if (!res.ok) continue;
      const data = (await res.json()) as { data?: Array<{ id?: unknown }> };
      if (data?.data && Array.isArray(data.data)) {
        return data.data
          .map((m) => m.id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
          .sort();
      }
    } catch {
      // try next path
    }
  }
  return [];
}
