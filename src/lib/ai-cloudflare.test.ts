import { generateText } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { getLanguageModel } from './ai-cloudflare';
import { findSharedAiBudgetDenied, SharedAiBudgetDenied } from './shared-ai-budget';

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const DAILY_CAP = 9_500;

function makeNamespace(reply?: unknown) {
  let used = 0;
  const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body)) as { neurons: number };
    used += request.neurons;
    if (reply !== undefined) return Response.json(reply);
    return Response.json({
      allowed: true,
      used,
      remaining: DAILY_CAP - used,
      retryAfter: 0,
      dayKey: new Date().toISOString().slice(0, 10),
    });
  });
  const namespace = {
    idFromName: (name: string) => name,
    get: () => ({ fetch }),
  } as unknown as DurableObjectNamespace;
  return { namespace, fetch };
}

function makeBinding(run: ReturnType<typeof vi.fn>) {
  return { run, marker: 'preserve-this-receiver' } as unknown as Ai;
}

describe('Workers AI language model budget integration', () => {
  it('reserves each actual SDK retry before calling the binding', async () => {
    const { namespace, fetch } = makeNamespace();
    let receiver: unknown;
    const run = vi.fn(function (this: unknown) {
      receiver = this;
      if (run.mock.calls.length === 1) {
        throw Object.assign(new Error('synthetic retryable rate-limit response'), { code: 3036 });
      }
      return Promise.resolve({
        choices: [
          { message: { role: 'assistant', content: 'Synthetic answer.' }, finish_reason: 'stop' },
        ],
      });
    });
    const model = getLanguageModel({
      binding: makeBinding(run),
      budgetNamespace: namespace,
      endpointUrl: '',
      apiKey: '',
      model: MODEL,
    });

    const result = await generateText({
      model,
      prompt: 'Synthetic UTF-8 probe: café ⚓',
      maxOutputTokens: 512,
      maxRetries: 1,
    });

    expect(result.text).toBe('Synthetic answer.');
    expect(run).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(receiver).toBe(run.mock.contexts[1]);
    expect(run.mock.contexts[0]).toBe(receiver);
    expect(run.mock.calls.every(([, input]) => input.max_tokens === 512)).toBe(true);
  });

  it('returns a typed budget denial without binding inference when the receipt is malformed', async () => {
    const { namespace, fetch } = makeNamespace(null);
    const run = vi.fn();
    const model = getLanguageModel({
      binding: makeBinding(run),
      budgetNamespace: namespace,
      endpointUrl: '',
      apiKey: '',
      model: MODEL,
    });

    let caught: unknown;
    try {
      await generateText({ model, prompt: 'Synthetic only.', maxRetries: 0 });
    } catch (error) {
      caught = error;
    }
    expect(findSharedAiBudgetDenied(caught)).toBeInstanceOf(SharedAiBudgetDenied);
    expect(fetch).toHaveBeenCalledOnce();
    expect(run).not.toHaveBeenCalled();
  });

  it('keeps explicit BYOK ahead of the Cloudflare binding and shared budget', () => {
    const { namespace, fetch } = makeNamespace();
    const run = vi.fn();
    const model = getLanguageModel({
      binding: makeBinding(run),
      budgetNamespace: namespace,
      endpointUrl: 'https://provider.example/v1',
      apiKey: 'synthetic-test-key',
      model: 'provider-model',
    });

    expect(model.modelId).toBe('provider-model');
    expect(fetch).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });
});
