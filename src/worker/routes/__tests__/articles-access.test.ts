import { Hono } from 'hono';
import { beforeEach, expect, it, vi } from 'vitest';

const access = vi.hoisted(() => ({
  user: vi.fn(),
  fetch: vi.fn(),
  owner: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
}));
vi.mock('../../../lib/auth-api', () => ({ getAuthenticatedUserId: access.user }));
vi.mock('../../../lib/articles-db', () => ({
  fetchArticleById: access.fetch,
  verifyArticleOwnership: access.owner,
  updateArticle: access.update,
  createArticleRecord: access.create,
}));

import routes from '../articles';

const app = new Hono().route('/api/articles', routes);
beforeEach(() => vi.clearAllMocks());

it('rejects guest import, read, and annotation before database access', async () => {
  access.user.mockResolvedValue(null);
  for (const [method, path] of [
    ['POST', ''],
    ['GET', '/synthetic'],
    ['PUT', '/synthetic'],
  ]) {
    const response = await app.request(`/api/articles${path}`, { method });
    expect(response.status).toBe(401);
  }
  expect(access.fetch).not.toHaveBeenCalled();
  expect(access.owner).not.toHaveBeenCalled();
  expect(access.create).not.toHaveBeenCalled();
  expect(access.update).not.toHaveBeenCalled();
});

it('scopes account reads and rejects annotation of an unowned article', async () => {
  access.user.mockResolvedValue('bob');
  access.fetch.mockResolvedValue(null);
  access.owner.mockResolvedValue(false);
  const read = await app.request('/api/articles/alice-article');
  expect(read.status).toBe(404);
  expect(access.fetch).toHaveBeenCalledWith('alice-article', 'bob');
  const write = await app.request('/api/articles/alice-article', { method: 'PUT' });
  expect(write.status).toBe(404);
  expect(access.owner).toHaveBeenCalledWith('alice-article', 'bob');
  expect(access.update).not.toHaveBeenCalled();
});
