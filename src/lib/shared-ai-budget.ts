import type { WorkersAISettings } from 'workers-ai-provider';

type WorkersAiBinding = Extract<WorkersAISettings, { binding: unknown }>['binding'];
type BindingRunOptions = Parameters<WorkersAiBinding['run']>[2];
export type SharedBudgetNamespace<Id> = {
  idFromName(name: string): Id;
  get(id: Id): { fetch(input: string, init?: RequestInit): Promise<Response> };
};

const DAILY_CAP = 9_500;
const DEFAULT_OUTPUT_TOKENS = 512;
const MAX_OUTPUT_TOKENS = 8_192;
const PRICED_MODEL_RATES: Record<string, { input: number; output: number }> = {
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast': { input: 26_668, output: 204_805 },
};

export class SharedAiBudgetDenied extends Error {
  constructor() {
    super('The shared daily Workers AI budget is unavailable or exhausted.');
    this.name = 'SharedAiBudgetDenied';
  }
}

export function findSharedAiBudgetDenied(error: unknown): SharedAiBudgetDenied | undefined {
  const seen = new Set<object>();
  let current: unknown = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    if (current instanceof SharedAiBudgetDenied) return current;
    seen.add(current);
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

function deny(): never {
  throw new SharedAiBudgetDenied();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function boundedOutputTokens(input: Record<string, unknown>): number {
  const value = input.max_tokens === undefined ? DEFAULT_OUTPUT_TOKENS : input.max_tokens;
  if (
    !Number.isSafeInteger(value) ||
    (value as number) <= 0 ||
    (value as number) > MAX_OUTPUT_TOKENS
  ) {
    return deny();
  }
  return value as number;
}

async function reserveWorkersAiCall<Id>(
  namespace: SharedBudgetNamespace<Id> | undefined,
  model: string,
  input: Record<string, unknown>,
  outputTokens: number
): Promise<void> {
  const rates = PRICED_MODEL_RATES[model];
  if (!rates || !namespace) return deny();

  let serialized: string;
  try {
    const json = JSON.stringify(input);
    if (typeof json !== 'string') return deny();
    serialized = json;
  } catch {
    return deny();
  }
  const inputBytes = new TextEncoder().encode(serialized).byteLength;
  const estimatedInputTokens = Math.ceil(inputBytes * 1.2);
  const neurons = Math.ceil(
    (estimatedInputTokens * rates.input + outputTokens * rates.output) / 1_000_000
  );
  if (!Number.isSafeInteger(neurons) || neurons <= 0 || neurons > DAILY_CAP) return deny();

  let response: Response;
  try {
    const stub = namespace.get(namespace.idFromName('global-budget'));
    response = await stub.fetch('https://internal.local/try-debit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ neurons }),
    });
  } catch {
    return deny();
  }
  if (response.status !== 200) return deny();

  let receipt: unknown;
  try {
    receipt = await response.json();
  } catch {
    return deny();
  }
  if (!isRecord(receipt)) return deny();
  if (
    receipt.allowed !== true ||
    receipt.dayKey !== new Date().toISOString().slice(0, 10) ||
    receipt.retryAfter !== 0 ||
    !Number.isSafeInteger(receipt.used) ||
    (receipt.used as number) < neurons ||
    !Number.isSafeInteger(receipt.remaining) ||
    (receipt.remaining as number) < 0 ||
    (receipt.used as number) + (receipt.remaining as number) !== DAILY_CAP
  ) {
    return deny();
  }
}

export function createBudgetedWorkersAiBinding<Id>(
  binding: WorkersAiBinding,
  namespace: SharedBudgetNamespace<Id> | undefined
): WorkersAiBinding {
  return new Proxy(binding, {
    get(target, property) {
      if (property === 'run') {
        return async (
          model: string,
          input: Record<string, unknown>,
          options?: BindingRunOptions
        ) => {
          if (!isRecord(input)) return deny();
          const outputTokens = boundedOutputTokens(input);
          const boundedInput = { ...input, max_tokens: outputTokens };
          await reserveWorkersAiCall(namespace, model, boundedInput, outputTokens);
          // Invoke through the target object: Ai.run depends on the binding receiver.
          return target.run(model, boundedInput, options);
        };
      }
      return Reflect.get(target, property, target);
    },
  });
}
