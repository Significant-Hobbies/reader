import { describe, expect, it, vi } from 'vitest';
import { createBudgetedWorkersAiBinding, SharedAiBudgetDenied } from './shared-ai-budget';

const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const DAILY_CAP = 9_500;

function makeBudget(reply?: unknown) {
  const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
    if (reply !== undefined) return Response.json(reply);
    const request = JSON.parse(String(init?.body)) as { neurons: number };
    return Response.json({
      allowed: true,
      used: request.neurons,
      remaining: DAILY_CAP - request.neurons,
      retryAfter: 0,
      dayKey: new Date().toISOString().slice(0, 10),
    });
  });
  const namespace = {
    idFromName: vi.fn((name: string) => name),
    get: vi.fn(() => ({ fetch })),
  } as unknown as DurableObjectNamespace;
  return { namespace, fetch };
}

function makeBinding() {
  let receiver: unknown;
  const binding = {
    marker: 'binding-receiver',
    run: vi.fn(function (
      this: { marker: string },
      _model: string,
      _input: Record<string, unknown>
    ) {
      receiver = this;
      return Promise.resolve({ response: 'synthetic result' });
    }),
  };
  return { binding, run: binding.run, getReceiver: () => receiver };
}

describe('shared Workers AI budget guard', () => {
  it('reserves UTF-8 serialized input, applies the 512 default, and preserves the binding receiver', async () => {
    const { namespace, fetch } = makeBudget();
    const { binding, run, getReceiver } = makeBinding();
    const guarded = createBudgetedWorkersAiBinding(binding as unknown as Ai, namespace);
    const input = { messages: [{ role: 'user', content: 'café ⚓' }] };
    const boundedInput = { ...input, max_tokens: 512 };

    await guarded.run(MODEL, input);

    const body = JSON.parse(String(fetch.mock.calls[0][1]?.body)) as { neurons: number };
    const bytes = new TextEncoder().encode(JSON.stringify(boundedInput)).byteLength;
    const inputTokens = Math.ceil(bytes * 1.2);
    const expected = Math.ceil((inputTokens * 26_668 + 512 * 204_805) / 1_000_000);
    expect(bytes).toBeGreaterThan(JSON.stringify(boundedInput).length);
    expect(body.neurons).toBe(expected);
    expect(run).toHaveBeenCalledOnce();
    expect(run.mock.calls[0][1]).toMatchObject(boundedInput);
    expect(getReceiver()).toBe(binding);
    expect(namespace.idFromName).toHaveBeenCalledWith('global-budget');
  });

  it.each([0, -1, 8_193, '512', Number.NaN])(
    'rejects invalid output token bound %j before debit or inference',
    async (max_tokens) => {
      const { namespace, fetch } = makeBudget();
      const { binding, run } = makeBinding();
      const guarded = createBudgetedWorkersAiBinding(binding as unknown as Ai, namespace);

      await expect(
        guarded.run(MODEL, { messages: [], max_tokens } as Record<string, unknown>)
      ).rejects.toBeInstanceOf(SharedAiBudgetDenied);
      expect(fetch).not.toHaveBeenCalled();
      expect(run).not.toHaveBeenCalled();
    }
  );

  it.each([null, [], 'allowed', 0, {}])(
    'fails closed for malformed debit receipt %j without inference',
    async (reply) => {
      const { namespace, fetch } = makeBudget(reply);
      const { binding, run } = makeBinding();
      const guarded = createBudgetedWorkersAiBinding(binding as unknown as Ai, namespace);

      await expect(
        guarded.run(MODEL, { messages: [], max_tokens: 512 } as Record<string, unknown>)
      ).rejects.toBeInstanceOf(SharedAiBudgetDenied);
      expect(fetch).toHaveBeenCalledOnce();
      expect(run).not.toHaveBeenCalled();
    }
  );

  it('fails closed on exhausted daily budget before inference', async () => {
    const { namespace, fetch } = makeBudget({
      allowed: false,
      used: DAILY_CAP,
      remaining: 0,
      retryAfter: 1,
      dayKey: new Date().toISOString().slice(0, 10),
    });
    const { binding, run } = makeBinding();
    const guarded = createBudgetedWorkersAiBinding(binding as unknown as Ai, namespace);

    await expect(
      guarded.run(MODEL, { messages: [], max_tokens: 512 } as Record<string, unknown>)
    ).rejects.toBeInstanceOf(SharedAiBudgetDenied);
    expect(fetch).toHaveBeenCalledOnce();
    expect(run).not.toHaveBeenCalled();
  });
});
