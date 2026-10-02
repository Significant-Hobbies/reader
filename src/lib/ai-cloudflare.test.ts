import { generateText, jsonSchema, Output, streamText } from 'ai';
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

describe('Free AI gateway SDK adapter', () => {
  it('preserves JSON mode, token bounds, stream passthrough, attribution, and production fail-closed behavior', async () => {
    const requests: Request[] = [];
    const fetch = vi.fn(async (request: Request) => {
      requests.push(request);
      const body = JSON.parse(await request.clone().text()) as { stream?: boolean };
      if (body.stream) {
        return new Response(
          'data: {"choices":[{"delta":{"content":"streamed"},"finish_reason":null}]}\n\n' +
            'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n' +
            'data: [DONE]\n\n',
          { headers: { 'content-type': 'text/event-stream' } }
        );
      }
      return Response.json({
        choices: [
          { message: { role: 'assistant', content: '{"ok":true}' }, finish_reason: 'stop' },
        ],
      });
    });
    const binding = { fetch } as unknown as Fetcher;
    const model = getLanguageModel({
      freeAiBinding: binding,
      endpointUrl: '',
      apiKey: '',
      model: 'ignored',
      nodeEnv: 'test',
    });

    await generateText({
      model,
      prompt: 'Synthetic JSON request',
      output: Output.object({
        schema: jsonSchema({
          type: 'object',
          properties: { ok: { type: 'boolean' } },
          required: ['ok'],
        }),
      }),
      maxOutputTokens: 73,
      maxRetries: 0,
    });
    const stream = streamText({ model, prompt: 'Synthetic stream request', maxRetries: 0 });
    await expect(stream.text).resolves.toBe('streamed');

    expect(fetch).toHaveBeenCalledTimes(2);
    for (const request of requests) {
      expect(request.url).toBe('https://fleet-gateway.internal/v1/chat/completions');
      expect(request.headers.get('x-gateway-project-id')).toBe('reader');
      expect(request.headers.get('authorization')).toBe('Bearer service-binding');
      expect(JSON.parse(await request.clone().text()).model).toBe('auto');
    }
    const jsonBody = JSON.parse(await requests[0].clone().text());
    expect(jsonBody.response_format).toEqual({ type: 'json_object' });
    expect(jsonBody.max_tokens).toBe(73);
    expect(JSON.parse(await requests[1].clone().text()).stream).toBe(true);

    expect(() =>
      getLanguageModel({ endpointUrl: '', apiKey: '', model: 'ignored', nodeEnv: 'production' })
    ).toThrow(/required in production/);
  });
});
