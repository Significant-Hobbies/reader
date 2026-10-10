import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import type { WorkerEnv } from '../lib/worker-env';
import { createReaderAppHealthMiddlewares } from './app-health';

describe('Reader App Health endpoint middleware', () => {
  it('is disabled without an ingest key', async () => {
    const createClient = vi.fn();
    const app = new Hono<{ Bindings: WorkerEnv }>();
    app.use('*', createReaderAppHealthMiddlewares(createClient).appHealthMiddleware);
    app.get('/api/articles/:articleId', (c) => c.json({ ok: true }));

    const response = await app.request('/api/articles/private-id?search=secret', {}, {});

    expect(response.status).toBe(200);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('records only the matched route summary and preserves the response', async () => {
    const record = vi.fn();
    const flush = vi.fn().mockResolvedValue(undefined);
    const waitUntil = vi.fn();
    const createClient = vi.fn(() => ({ record, flush }) as never);
    const app = new Hono<{ Bindings: WorkerEnv }>();
    app.use('*', createReaderAppHealthMiddlewares(createClient).appHealthMiddleware);
    app.on(['GET', 'POST'], '/api/articles/:articleId', (c) =>
      c.json({ content: 'private article body' })
    );

    const response = await app.request(
      '/api/articles/private-id?search=private-query',
      {
        method: 'POST',
        headers: { Authorization: 'Bearer private-token', Cookie: 'session=private-cookie' },
        body: 'private request body',
      },
      { APP_HEALTH_INGEST_KEY: 'synthetic-test-key' } as WorkerEnv,
      { waitUntil } as unknown as ExecutionContext
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ content: 'private article body' });
    expect(createClient).toHaveBeenCalledWith({
      key: 'synthetic-test-key',
      environment: 'production',
      endpoint: 'https://ingest.sassmaker.com/v1/ingest',
      runtime: 'worker',
      disableTimer: true,
    });
    expect(record).toHaveBeenCalledOnce();
    const event = record.mock.calls[0][0];
    expect(event).toMatchObject({
      method: 'POST',
      route: '/api/articles/:articleId',
      status_code: 200,
    });
    expect(JSON.stringify(event)).not.toContain('private-id');
    expect(JSON.stringify(event)).not.toContain('private-query');
    expect(JSON.stringify(event)).not.toContain('private-token');
    expect(JSON.stringify(event)).not.toContain('private-cookie');
    expect(JSON.stringify(event)).not.toContain('private request body');
    expect(JSON.stringify(event)).not.toContain('private article body');
    expect(flush).toHaveBeenCalledOnce();
    expect(waitUntil).toHaveBeenCalledOnce();

    const secondResponse = await app.request(
      '/api/articles/another-private-id?search=another-private-query',
      {},
      { APP_HEALTH_INGEST_KEY: 'synthetic-test-key' } as WorkerEnv,
      { waitUntil } as unknown as ExecutionContext
    );

    expect(secondResponse.status).toBe(200);
    expect(createClient).toHaveBeenCalledOnce();
    expect(record).toHaveBeenCalledTimes(2);
    expect(waitUntil).toHaveBeenCalledTimes(2);
    expect(record.mock.calls[1][0].route).toBe('/api/articles/:articleId');
    expect(JSON.stringify(record.mock.calls[1][0])).not.toContain('another-private-id');
    expect(JSON.stringify(record.mock.calls[1][0])).not.toContain('another-private-query');
  });
});

describe('Reader App Health stage timing', () => {
  function setup() {
    const log = vi.fn();
    const record = vi.fn();
    const flush = vi.fn().mockResolvedValue(undefined);
    const createClient = vi.fn(() => ({ log, record, flush }) as never);
    const middleware = createReaderAppHealthMiddlewares(createClient);
    const app = new Hono<{ Bindings: WorkerEnv }>();
    app.use('*', async (c, next) => {
      middleware.trackRequest(c.req.raw);
      await next();
    });
    app.use('*', middleware.appHealthMiddleware);
    for (const path of ['/api/links/*', '/api/articles/*', '/api/mcp/*', '/api/keys/*']) {
      app.use(path, middleware.stageTimingMiddleware);
    }
    app.get('/api/links', (c) => c.json({ ok: true }));
    app.get('/api/articles/:articleId', (c) => c.json({ ok: true }));
    app.get('/landing', (c) => c.text('landing'));
    const env = {
      APP_HEALTH_INGEST_KEY: 'synthetic-test-key',
      APP_HEALTH_STAGE_SAMPLE_RATE: '1',
    } as WorkerEnv;
    return { app, log, flush, createClient, env };
  }

  it('logs one bounded template record and shares the cached client', async () => {
    const { app, log, flush, createClient, env } = setup();
    const waitUntil = vi.fn();
    const response = await app.request('/api/articles/123?secret=query', {}, env, {
      waitUntil,
    } as unknown as ExecutionContext);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(log).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith('api.stage_timing', {
      level: 'debug',
      props: {
        route: '/api/articles/:articleId',
        status: 200,
        total_ms: expect.any(Number),
        edge_cache: 'NONE',
        inner_cache: 'NONE',
        colo: 'unknown',
        cold: 1,
      },
    });
    const props = log.mock.calls[0][1].props;
    expect(Number.isInteger(props.total_ms)).toBe(true);
    expect(props.total_ms).toBeGreaterThanOrEqual(0);
    expect(props.total_ms).toBeLessThanOrEqual(600000);
    expect(createClient).toHaveBeenCalledOnce();
    expect(flush).toHaveBeenCalledTimes(2);
    expect(waitUntil).toHaveBeenCalledTimes(2);
    await app.request('/api/links', {}, env);
    expect(log).toHaveBeenCalledTimes(2);
    expect(log.mock.calls[1][1].props).toMatchObject({ route: '/api/links', cold: 0 });
    expect(createClient).toHaveBeenCalledOnce();
  });

  it.each(['0', undefined])('does not log at rate zero or without a key (%s)', async (rate) => {
    const { app, log, env } = setup();
    if (rate === undefined) delete env.APP_HEALTH_INGEST_KEY;
    else env.APP_HEALTH_STAGE_SAMPLE_RATE = rate;
    expect((await app.request('/api/links', {}, env)).status).toBe(200);
    expect(log).not.toHaveBeenCalled();
  });

  it.each(['invalid', '-1', '2', '', undefined])(
    'defaults invalid/missing rate %s to 0.1',
    async (rate) => {
      const { app, log, env } = setup();
      env.APP_HEALTH_STAGE_SAMPLE_RATE = rate;
      const random = vi.spyOn(Math, 'random').mockReturnValue(0.1);
      try {
        await app.request('/api/links', {}, env);
        expect(log).not.toHaveBeenCalled();
        random.mockReturnValue(0.09);
        await app.request('/api/links', {}, env);
        expect(log).toHaveBeenCalledOnce();
      } finally {
        random.mockRestore();
      }
    }
  );

  it.each([
    '/api/links/123',
    '/api/links/0123456789abcdef',
    '/api/links/12345678-abcd-1234-abcd-123456789012',
    `/api/links/${'x'.repeat(121)}`,
  ])('rejects unsafe route %s', async (route) => {
    const { app, log, env } = setup();
    app.get(route, (c) => c.text('ok'));
    expect((await app.request(route, {}, env)).status).toBe(200);
    expect(log).not.toHaveBeenCalled();
  });

  it('counts an earlier uninstrumented request as warm', async () => {
    const { app, log, env } = setup();
    await app.request('/landing', {}, env);
    expect(log).not.toHaveBeenCalled();
    await app.request('/api/links', {}, env);
    expect(log.mock.calls[0][1].props.cold).toBe(0);
  });

  it.each(['create', 'log', 'flush', 'reject'])(
    'client %s errors preserve the response',
    async (failure) => {
      const { app, log, flush, createClient, env } = setup();
      const fail = () => {
        throw new Error('telemetry unavailable');
      };
      if (failure === 'create') createClient.mockImplementation(fail);
      if (failure === 'log') log.mockImplementation(fail);
      if (failure === 'flush') flush.mockImplementation(fail);
      if (failure === 'reject') flush.mockRejectedValue(new Error('telemetry unavailable'));
      expect((await app.request('/api/links', {}, env)).status).toBe(200);
    }
  );
});
