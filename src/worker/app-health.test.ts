import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import type { WorkerEnv } from '../lib/worker-env';
import { createReaderAppHealthMiddleware } from './app-health';

describe('Reader App Health endpoint middleware', () => {
  it('is disabled without an ingest key', async () => {
    const createClient = vi.fn();
    const app = new Hono<{ Bindings: WorkerEnv }>();
    app.use('*', createReaderAppHealthMiddleware(createClient));
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
    app.use('*', createReaderAppHealthMiddleware(createClient));
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
