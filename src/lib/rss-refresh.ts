import { fetchWithValidatedRedirects } from './safe-fetch';
import {
  getOwnedRssFeed,
  listRssFeeds,
  updateRssFeedAfterRefresh,
  upsertRssEntries,
} from './rss-db';
import { MAX_FEED_BYTES, parseFeed } from './rss-parser';
import { validateExternalUrl } from './url-validation';

const REFRESH_CONCURRENCY = 4;
const REFRESH_TIMEOUT_MS = 15_000;

interface RssRefreshResult {
  feedId: string;
  title: string;
  inserted: number;
  status: 'ok' | 'not-modified' | 'error';
  error?: string;
}

async function refreshFeed(feed: {
  id: string;
  title: string;
  feedUrl: string;
  etag: string | null;
  lastModified: string | null;
}): Promise<RssRefreshResult> {
  try {
    const validation = await validateExternalUrl(feed.feedUrl);
    if (!validation.ok) throw new Error(validation.reason);

    const headers = new Headers({
      Accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml;q=0.9',
    });
    if (feed.etag) headers.set('If-None-Match', feed.etag);
    if (feed.lastModified) headers.set('If-Modified-Since', feed.lastModified);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);
    let response: Response;
    try {
      ({ response } = await fetchWithValidatedRedirects(
        validation.url,
        { headers, signal: controller.signal },
        { validateUrl: validateExternalUrl }
      ));
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 304) {
      await updateRssFeedAfterRefresh(feed.id, { error: null });
      return { feedId: feed.id, title: feed.title, inserted: 0, status: 'not-modified' };
    }
    if (!response.ok) throw new Error(`Feed returned HTTP ${response.status}`);

    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > MAX_FEED_BYTES) throw new Error('Feed response is too large');
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_FEED_BYTES) throw new Error('Feed response is too large');

    const parsed = parseFeed(new TextDecoder().decode(buffer));
    const inserted = await upsertRssEntries(feed.id, parsed.entries);
    await updateRssFeedAfterRefresh(feed.id, {
      title: parsed.title,
      siteUrl: parsed.siteUrl,
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
      error: null,
    });
    return { feedId: feed.id, title: parsed.title ?? feed.title, inserted, status: 'ok' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Feed refresh failed';
    await updateRssFeedAfterRefresh(feed.id, { error: message });
    return { feedId: feed.id, title: feed.title, inserted: 0, status: 'error', error: message };
  }
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

export async function refreshRssFeeds(userId: string, feedId?: string) {
  const feeds = feedId
    ? [await getOwnedRssFeed(userId, feedId)].filter(Boolean)
    : await listRssFeeds(userId).then(async (items) =>
        Promise.all(items.map((item) => getOwnedRssFeed(userId, item.id)))
      );
  return mapWithConcurrency(
    feeds.filter((feed): feed is NonNullable<typeof feed> => Boolean(feed)),
    REFRESH_CONCURRENCY,
    refreshFeed
  );
}
