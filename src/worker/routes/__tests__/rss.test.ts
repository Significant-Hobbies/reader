import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAuthenticatedUserId: vi.fn(),
  addRssFeed: vi.fn(),
  deleteRssFeed: vi.fn(),
  getOwnedRssEntry: vi.fn(),
  linkRssEntryToArticle: vi.fn(),
  listRssEntries: vi.fn(),
  listRssFeeds: vi.fn(),
  setRssEntryReadState: vi.fn(),
  refreshRssFeeds: vi.fn(),
  validateExternalUrl: vi.fn(),
  createArticleRecord: vi.fn(),
  findArticleByUrl: vi.fn(),
}));

vi.mock('../../../lib/auth-api', () => ({
  getAuthenticatedUserId: mocks.getAuthenticatedUserId,
}));
vi.mock('../../../lib/rss-db', () => ({
  addRssFeed: mocks.addRssFeed,
  deleteRssFeed: mocks.deleteRssFeed,
  getOwnedRssEntry: mocks.getOwnedRssEntry,
  linkRssEntryToArticle: mocks.linkRssEntryToArticle,
  listRssEntries: mocks.listRssEntries,
  listRssFeeds: mocks.listRssFeeds,
  setRssEntryReadState: mocks.setRssEntryReadState,
}));
vi.mock('../../../lib/rss-refresh', () => ({ refreshRssFeeds: mocks.refreshRssFeeds }));
vi.mock('../../../lib/url-validation', () => ({
  validateExternalUrl: mocks.validateExternalUrl,
}));
vi.mock('../../../lib/articles-db', () => ({
  createArticleRecord: mocks.createArticleRecord,
  findArticleByUrl: mocks.findArticleByUrl,
}));

import rssRoutes from '../rss';

const app = new Hono();
app.route('/api/rss', rssRoutes);

describe('RSS routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAuthenticatedUserId.mockResolvedValue('user-1');
    mocks.validateExternalUrl.mockImplementation(async (url: string) => ({
      ok: true,
      url: new URL(url),
    }));
  });

  it('does not fetch feeds when refresh is unauthenticated', async () => {
    mocks.getAuthenticatedUserId.mockResolvedValue(null);
    const response = await app.request('/api/rss/refresh', { method: 'POST' });
    expect(response.status).toBe(401);
    expect(mocks.refreshRssFeeds).not.toHaveBeenCalled();
  });

  it('adds a validated feed and reports duplicate subscriptions', async () => {
    mocks.addRssFeed.mockResolvedValue({ id: 'feed-1', existing: true });
    const response = await app.request('/api/rss/feeds', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ feedUrl: 'https://example.com/feed.xml', title: 'Example' }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 'feed-1', existing: true });
    expect(mocks.addRssFeed).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', feedUrl: 'https://example.com/feed.xml' })
    );
  });

  it('rejects unsafe feed URLs before persistence', async () => {
    mocks.validateExternalUrl.mockResolvedValue({ ok: false, reason: 'Blocked: localhost' });
    const response = await app.request('/api/rss/feeds', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ feedUrl: 'http://localhost/feed' }),
    });
    expect(response.status).toBe(400);
    expect(mocks.addRssFeed).not.toHaveBeenCalled();
  });

  it('removes only a feed accepted by the user-scoped database operation', async () => {
    mocks.deleteRssFeed.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const missing = await app.request('/api/rss/feeds/not-owned', { method: 'DELETE' });
    const owned = await app.request('/api/rss/feeds/owned', { method: 'DELETE' });
    expect(missing.status).toBe(404);
    expect(owned.status).toBe(200);
    expect(mocks.deleteRssFeed).toHaveBeenNthCalledWith(1, 'user-1', 'not-owned');
  });
});
