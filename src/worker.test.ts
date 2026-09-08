import { beforeEach, expect, it, vi } from 'vitest';
import type { WorkerEnv } from './lib/worker-env';

const mocks = vi.hoisted(() => ({ auth: vi.fn(), user: vi.fn(), assets: vi.fn() }));
vi.mock('./lib/auth', () => ({ createAuth: () => ({ handler: mocks.auth }) }));
vi.mock('./lib/auth-api', () => ({ getAuthenticatedUserId: mocks.user }));
vi.mock('./worker/bind-env', () => ({ bindWorkerEnv: vi.fn() }));

import worker from './worker';

const env = { ASSETS: { fetch: mocks.assets } } as unknown as WorkerEnv;
const context = {} as ExecutionContext;
const request = (path: string, method = 'GET') =>
  worker.fetch(new Request(`https://reader.test${path}`, { method }), env, context);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue(null);
  mocks.auth.mockImplementation(() => Response.json(null));
});

it('routes session GETs through authentication instead of discovery 404', async () => {
  const response = await request('/api/auth/get-session');
  expect(response.status).toBe(200);
  expect(await response.json()).toBeNull();
  expect(mocks.auth).toHaveBeenCalledOnce();
  expect(mocks.assets).not.toHaveBeenCalled();
});

it('keeps snapshot and account reads protected by their real handlers', async () => {
  for (const path of ['/api/snapshot?url=https://example.com', '/api/articles/synthetic']) {
    const response = await request(path);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  }
  expect(mocks.user).toHaveBeenCalledTimes(2);
  expect(mocks.assets).not.toHaveBeenCalled();
});

it('preserves discovery GET and HEAD without invoking account services', async () => {
  for (const path of ['/api/ai', '/api/ai/', '/openapi.json']) {
    const response = await request(path);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
  }
  const head = await request('/api/ai', 'HEAD');
  expect(head.status).toBe(200);
  expect(await head.text()).toBe('');
  expect(mocks.auth).not.toHaveBeenCalled();
  expect(mocks.user).not.toHaveBeenCalled();
});
