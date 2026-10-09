// @vitest-environment node
import { Hono } from 'hono';
import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  mark: vi.fn(),
  content: vi.fn(),
}));
vi.mock('../../../lib/auth-api', () => ({ authenticateMcpReader: mocks.auth }));
vi.mock('../../../lib/links-db', () => ({
  listLinks: mocks.list,
  getLink: mocks.get,
  setLinkRead: mocks.mark,
}));
vi.mock('../../../lib/link-content', async (original) => ({
  ...(await original<typeof import('../../../lib/link-content')>()),
  fetchLinkContent: mocks.content,
}));
import routes, { protectedResourceMetadata } from '../mcp';
import type { WorkerEnv } from '../../../lib/worker-env';

const app = new Hono().route('/api/mcp', routes);
const call = (method: string, params?: unknown, headers: Record<string, string> = {}) =>
  app.request('/api/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
const item = {
  id: 'one',
  url: 'https://example.com',
  title: 'One',
  status: 'unread',
  storedContent: '<p>Evidence</p><script>bad()</script>',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ status: 'authorized', userId: 'alice' });
  mocks.list.mockResolvedValue({ items: [], total: 0, nextOffset: null });
  mocks.get.mockResolvedValue(item);
  mocks.mark.mockResolvedValue({ ...item, status: 'read' });
});

it('initializes stateless MCP and advertises only three correctly annotated tools', async () => {
  const init = await call('initialize', { protocolVersion: '2025-11-25' });
  expect((await init.json()).result.protocolVersion).toBe('2025-11-25');
  const tools = (await (await call('tools/list')).json()).result.tools;
  expect(tools.map((tool: { name: string }) => tool.name)).toEqual(['search', 'fetch', 'set_read']);
  expect(tools[2].annotations).toMatchObject({ readOnlyHint: false, destructiveHint: false });
  expect(mocks.auth).not.toHaveBeenCalled();
});

it('defaults search to unread, scopes it to the owner, and never changes read state during retrieval', async () => {
  await call('tools/call', { name: 'search', arguments: { query: 'evidence' } });
  expect(mocks.list).toHaveBeenCalledWith('alice', {
    query: 'evidence',
    status: 'unread',
    offset: 0,
  });
  const fetched = (
    await (await call('tools/call', { name: 'fetch', arguments: { id: 'one' } })).json()
  ).result;
  expect(JSON.parse(fetched.content[0].text)).toMatchObject({
    id: 'one',
    text: 'Evidence',
    contentStatus: 'stored',
  });
  expect(mocks.get).toHaveBeenCalledWith('alice', 'one');
  expect(mocks.mark).not.toHaveBeenCalled();
});

it('requires write scope and a real boolean to change read state', async () => {
  const params = { name: 'set_read', arguments: { id: 'one', read: true } };
  await call('tools/call', params);
  expect(mocks.auth.mock.calls[0][2]).toBe('reader.write');
  expect(mocks.mark).toHaveBeenCalledWith('alice', 'one', true);
  mocks.mark.mockClear();
  const invalid = await call('tools/call', { ...params, arguments: { id: 'one', read: 'false' } });
  expect((await invalid.json()).result.isError).toBe(true);
  expect(mocks.mark).not.toHaveBeenCalled();
  mocks.auth.mockResolvedValue({ status: 'invalid' });
  expect((await (await call('tools/call', params)).json()).result.isError).toBe(true);
  expect(mocks.mark).not.toHaveBeenCalled();
});

it('challenges missing credentials, does not execute notification writes, and denies hostile origins', async () => {
  mocks.auth.mockResolvedValue({ status: 'invalid' });
  const rejected = await call('tools/call', { name: 'search' });
  expect((await rejected.json()).result._meta['mcp/www_authenticate'][0]).toContain('reader.read');
  expect(rejected.headers.get('WWW-Authenticate')).toContain(
    '/api/mcp/.well-known/oauth-protected-resource'
  );
  expect(mocks.list).not.toHaveBeenCalled();
  const notification = await app.request('/api/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: { name: 'set_read', arguments: { id: 'one', read: true } },
    }),
  });
  expect(notification.status).toBe(202);
  expect(mocks.mark).not.toHaveBeenCalled();
  expect((await call('tools/list', {}, { Origin: 'https://evil.example' })).status).toBe(403);
});

it('returns unavailable content honestly and never fetches an unowned link', async () => {
  mocks.get.mockResolvedValue({ ...item, storedContent: '' });
  mocks.content.mockRejectedValue(new Error('Blocked'));
  const result = (
    await (await call('tools/call', { name: 'fetch', arguments: { id: 'one' } })).json()
  ).result;
  expect(JSON.parse(result.content[0].text)).toMatchObject({
    text: '',
    contentStatus: 'unavailable',
  });
  mocks.get.mockResolvedValue(null);
  mocks.content.mockClear();
  const missing = (
    await (await call('tools/call', { name: 'fetch', arguments: { id: 'other' } })).json()
  ).result;
  expect(missing.isError).toBe(true);
  expect(mocks.content).not.toHaveBeenCalled();
});

it('exposes OAuth resource metadata only for a valid configured issuer', () => {
  const request = new Request('https://reader.test/.well-known/oauth-protected-resource/api/mcp');
  expect(protectedResourceMetadata(request, {} as WorkerEnv).status).toBe(503);
  expect(
    protectedResourceMetadata(request, {
      AUTH0_ISSUER: 'https://fleet-test.us.auth0.com/',
    } as WorkerEnv).status
  ).toBe(200);
});

it('keeps bridge reads and writes isolated and authenticated', async () => {
  await app.request('/api/mcp/reading');
  expect(mocks.list).toHaveBeenCalledWith('alice', {
    query: undefined,
    status: 'unread',
    offset: 0,
  });
  await app.request('/api/mcp/reading/one', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ read: false }),
  });
  expect(mocks.auth.mock.calls.at(-1)?.[2]).toBe('reader.write');
  expect(mocks.mark).toHaveBeenCalledWith('alice', 'one', false);
});
