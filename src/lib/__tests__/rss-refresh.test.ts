import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getOwnedRssFeed: vi.fn(),
  listRssFeeds: vi.fn(),
  updateRssFeedAfterRefresh: vi.fn(),
  upsertRssEntries: vi.fn(),
  fetchWithValidatedRedirects: vi.fn(),
  validateExternalUrl: vi.fn(),
}));

vi.mock('../rss-db', () => ({
  getOwnedRssFeed: mocks.getOwnedRssFeed,
  listRssFeeds: mocks.listRssFeeds,
  updateRssFeedAfterRefresh: mocks.updateRssFeedAfterRefresh,
  upsertRssEntries: mocks.upsertRssEntries,
}));

vi.mock('../safe-fetch', () => ({
  fetchWithValidatedRedirects: mocks.fetchWithValidatedRedirects,
}));

vi.mock('../url-validation', () => ({
  validateExternalUrl: mocks.validateExternalUrl,
}));

describe('refreshRssFeeds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateExternalUrl.mockImplementation(async (url: string) => ({
      ok: true,
      url: new URL(url),
    }));
    mocks.upsertRssEntries.mockResolvedValue(1);
    mocks.updateRssFeedAfterRefresh.mockResolvedValue(undefined);
  });

  it('persists a valid feed and returns inserted entries', async () => {
    mocks.getOwnedRssFeed.mockResolvedValue({
      id: 'feed-1',
      title: 'Feed',
      feedUrl: 'https://example.com/feed.xml',
      etag: null,
      lastModified: null,
    });
    mocks.fetchWithValidatedRedirects.mockResolvedValue({
      response: new Response(
        '<rss><channel><title>Feed</title><item><guid>1</guid><title>Post</title><link>https://example.com/post</link></item></channel></rss>',
        { status: 200 }
      ),
      url: new URL('https://example.com/feed.xml'),
    });

    const { refreshRssFeeds } = await import('../rss-refresh');
    const results = await refreshRssFeeds('user-1', 'feed-1');

    expect(results).toEqual([{ feedId: 'feed-1', title: 'Feed', inserted: 1, status: 'ok' }]);
    expect(mocks.upsertRssEntries).toHaveBeenCalledOnce();
  });

  it('returns per-feed errors without discarding successful refreshes', async () => {
    const feeds = [
      { id: 'a', title: 'A', feedUrl: 'https://a.example/feed', etag: null, lastModified: null },
      { id: 'b', title: 'B', feedUrl: 'https://b.example/feed', etag: null, lastModified: null },
    ];
    mocks.listRssFeeds.mockResolvedValue(feeds);
    mocks.getOwnedRssFeed.mockImplementation(async (_userId: string, id: string) =>
      feeds.find((feed) => feed.id === id)
    );
    mocks.fetchWithValidatedRedirects.mockImplementation(async (url: URL) => {
      if (url.hostname === 'b.example') throw new Error('Network failed');
      return {
        response: new Response(
          '<feed><title>A</title><entry><id>1</id><title>Post</title><link href="https://a.example/post" /></entry></feed>',
          { status: 200 }
        ),
        url,
      };
    });

    const { refreshRssFeeds } = await import('../rss-refresh');
    const results = await refreshRssFeeds('user-1');

    expect(results.map((result) => result.status).sort()).toEqual(['error', 'ok']);
    expect(mocks.updateRssFeedAfterRefresh).toHaveBeenCalledWith(
      'b',
      expect.objectContaining({ error: 'Network failed' })
    );
  });

  it('returns an empty result for an unowned feed', async () => {
    mocks.getOwnedRssFeed.mockResolvedValue(null);
    const { refreshRssFeeds } = await import('../rss-refresh');
    expect(await refreshRssFeeds('user-1', 'other-users-feed')).toEqual([]);
    expect(mocks.fetchWithValidatedRedirects).not.toHaveBeenCalled();
  });
});
