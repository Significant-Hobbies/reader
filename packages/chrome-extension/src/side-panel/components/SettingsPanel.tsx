import type { AIConfig, AIProvider } from '../lib/types';
import { PROVIDER_LABELS, FALLBACK_MODELS } from '../lib/types';

interface SettingsPanelProps {
  config: AIConfig;
  onConfigChange: (config: AIConfig) => void;
}

const getDefaultModel = (provider: AIProvider) =>
  FALLBACK_MODELS[provider][0] ?? FALLBACK_MODELS.gateway[0];

export function SettingsPanel({ config, onConfigChange }: SettingsPanelProps) {
  return (
    <div className="mt-2 space-y-2 rounded-xl border border-gray-800 bg-gray-950/80 p-2.5">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-xs text-gray-400">
          <span>Provider</span>
          <select
            value={config.provider}
            onChange={(e) => {
              const provider = e.target.value as AIProvider;
              onConfigChange({
                ...config,
                provider,
                model: getDefaultModel(provider),
              });
            }}
            className="h-8 w-full rounded-lg border border-gray-700 bg-gray-900 px-2 text-xs text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {(Object.keys(PROVIDER_LABELS) as AIProvider[]).map((p) => (
              <option key={p} value={p}>
                {PROVIDER_LABELS[p]}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-xs text-gray-400">
          <span>Model</span>
          <select
            value={config.model}
            onChange={(e) => onConfigChange({ ...config, model: e.target.value })}
            className="h-8 w-full rounded-lg border border-gray-700 bg-gray-900 px-2 text-xs text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {(FALLBACK_MODELS[config.provider] ?? []).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>

      {config.provider !== 'gateway' && (
        <label className="space-y-1 text-xs text-gray-400">
          <span>API key (stored locally in extension)</span>
          <input
            type="password"
            value={config.apiKey}
            onChange={(e) => onConfigChange({ ...config, apiKey: e.target.value })}
            placeholder="Paste your API key"
            className="h-8 w-full rounded-lg border border-gray-700 bg-gray-900 px-2 text-xs text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
      )}
    </div>
  );
}
