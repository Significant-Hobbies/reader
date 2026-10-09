import { Hono } from 'hono';
import { beforeEach, expect, it, vi } from 'vitest';
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
  mocks.add.mockResolvedValue({ id: 'one' });
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
