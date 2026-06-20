'use client';

// Local vendored AI React hooks (formerly @saas-maker/ai). Self-contained;
// only depends on ./ai-vendor and React.

import { useCallback, useState } from 'react';

import { type AIConfig, fetchModels, getAIConfig, saveAIConfig } from './ai-vendor';

export function useAIConfig(storageKey = 'ai-config') {
  const [config, setConfigState] = useState<AIConfig>(() => getAIConfig(storageKey));
  const setConfig = useCallback((next: AIConfig | ((prev: AIConfig) => AIConfig)) => {
    setConfigState((prev) =>
      typeof next === 'function' ? (next as (p: AIConfig) => AIConfig)(prev) : next
    );
  }, []);
  const update = useCallback((partial: Partial<AIConfig>) => {
    setConfigState((prev) => ({ ...prev, ...partial }));
  }, []);
  const save = useCallback(() => {
    setConfigState((current) => {
      saveAIConfig(current, storageKey);
      return current;
    });
  }, [storageKey]);
  const isReady = !!(config.endpointUrl && config.apiKey);
  return { config, setConfig, update, save, isReady };
}

export interface UseModelDiscoveryOptions {
  /** Server-side proxy URL for model discovery (avoids CORS issues). */
  modelsApiUrl?: string;
}

export function useModelDiscovery(options: UseModelDiscoveryOptions = {}) {
  const { modelsApiUrl } = options;
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const discover = useCallback(
    async (endpointUrl: string, apiKey: string) => {
      if (!endpointUrl.trim()) return;
      setLoading(true);
      setError(null);
      try {
        let result: string[];
        if (modelsApiUrl) {
          const res = await fetch(modelsApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpointUrl, apiKey }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as { models?: string[] };
          result = data.models ?? [];
        } else {
          result = await fetchModels(endpointUrl, apiKey);
        }
        setModels(result);
      } catch {
        setError('Failed to fetch models');
        setModels([]);
      } finally {
        setLoading(false);
      }
    },
    [modelsApiUrl]
  );
  return { models, loading, error, discover };
}
