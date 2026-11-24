import { Hono } from 'hono';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { WorkerEnv } from '../../../lib/worker-env';
import { appHealthMiddleware } from '../../app-health';
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  add: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  mark: vi.fn(),
}));
vi.mock('../../../lib/auth-api', () => ({ getAuthenticatedUserId: mocks.auth }));
vi.mock('../../../lib/links-db', () => ({
  addLink: mocks.add,
  getLink: mocks.get,
  listLinks: mocks.list,
  setLinkRead: mocks.mark,
}));
import routes from '../articles';
const app = new Hono().route('/api/links', routes);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue('alice');
});
it('rejects guest capture and reads before database access', async () => {
  mocks.auth.mockResolvedValue(null);
  for (const method of ['GET', 'POST', 'PUT'])
    expect((await app.request('/api/links/one', { method })).status).toBe(401);
  expect(mocks.add).not.toHaveBeenCalled();
  expect(mocks.get).not.toHaveBeenCalled();
  expect(mocks.mark).not.toHaveBeenCalled();
});
it('captures URL-only links and scopes updates to the authenticated account', async () => {
  mocks.add.mockResolvedValue({ id: 'one', existing: false });
  const response = await app.request('/api/links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: 'https://example.com' }),
  });
  expect(response.status).toBe(200);
  expect(mocks.add).toHaveBeenCalledWith('alice', { url: 'https://example.com' });
  mocks.mark.mockResolvedValue(null);
  expect(
    (
      await app.request('/api/links/other', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'read' }),
      })
    ).status
  ).toBe(404);
  expect(mocks.mark).toHaveBeenCalledWith('alice', 'other', true);
});

afterEach(() => vi.unstubAllGlobals());

it('ships a content-free log only for new saved links through both capture paths', async () => {
  const deliveries = vi
    .fn<typeof fetch>()
    .mockImplementation(async () => new Response(null, { status: 202 }));
  vi.stubGlobal('fetch', deliveries);
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (work: Promise<unknown>) => pending.push(work) } as ExecutionContext;
  const env = {
    APP_HEALTH_INGEST_KEY: 'fixture-ingest-key',
    APP_HEALTH_ENVIRONMENT: 'test',
  } as WorkerEnv;
  const product = new Hono<{ Bindings: WorkerEnv }>();
  product.use('*', appHealthMiddleware);
  product.route('/api/links', routes);
  product.route('/api/articles', routes);
  const save = (path: string, auth: Record<string, string>) =>
    product.request(
      path,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({
          url: 'https://example.test/saved-path',
          title: 'Private saved title',
        }),
      },
      env,
      ctx
    );

  mocks.add
    .mockResolvedValueOnce({ id: 'browser-link', existing: false })
    .mockResolvedValueOnce({ id: 'extension-link', existing: false })
    .mockResolvedValueOnce({ id: 'extension-link', existing: true })
    .mockRejectedValueOnce(new TypeError('Invalid URL'));

  expect((await save('/api/links', { Cookie: 'session=fixture' })).status).toBe(200);
  await Promise.all(pending.splice(0));
  expect((await save('/api/articles', { Authorization: 'Bearer rdr_fixture' })).status).toBe(200);
  await Promise.all(pending.splice(0));
  expect(await (await save('/api/links', { Authorization: 'Bearer rdr_fixture' })).json()).toEqual({
    id: 'extension-link',
    existing: true,
  });
  await Promise.all(pending.splice(0));
  expect((await save('/api/links', { Cookie: 'session=fixture' })).status).toBe(400);
  await Promise.all(pending.splice(0));
  mocks.auth.mockResolvedValueOnce(null);
  expect((await save('/api/links', {})).status).toBe(401);
  await Promise.all(pending.splice(0));

  const batches = deliveries.mock.calls
    .filter(([url]) => String(url) === 'https://ingest.sassmaker.com/v1/logs')
    .map(([, request]) => JSON.parse(String(request?.body)));
  expect(batches).toHaveLength(2);
  const logs = batches.flatMap((batch) => batch.logs);
  expect(logs).toHaveLength(2);
  for (const log of logs) {
    expect(log).toMatchObject({ event: 'link.saved', level: 'debug' });
    expect(log.props).toEqual({});
    expect(Object.keys(log).sort()).toEqual(['event', 'level', 'log_id', 'props', 'timestamp']);
  }
});
