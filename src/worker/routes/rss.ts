import { type Context, Hono } from 'hono';

import { createArticleRecord, findArticleByUrl } from '../../lib/articles-db';
import { getAuthenticatedUserId } from '../../lib/auth-api';
import {
  addRssFeed,
  deleteRssFeed,
  getOwnedRssEntry,
  linkRssEntryToArticle,
  listRssEntries,
  listRssFeeds,
  setRssEntryReadState,
} from '../../lib/rss-db';
import { type OpmlSubscription, parseOpml } from '../../lib/rss-parser';
import { refreshRssFeeds } from '../../lib/rss-refresh';
import { validateExternalUrl } from '../../lib/url-validation';
import type { WorkerEnv } from '../../lib/worker-env';

const rss = new Hono<{ Bindings: WorkerEnv }>();
const OPML_IMPORT_CONCURRENCY = 6;

async function requireUser(c: Context<{ Bindings: WorkerEnv }>) {
  return getAuthenticatedUserId(c.req.raw.headers, c.env);
}

rss.get('/feeds', async (c) => {
  const userId = await requireUser(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  return c.json(await listRssFeeds(userId));
});

rss.post('/feeds', async (c) => {
  const userId = await requireUser(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.feedUrl !== 'string') return c.json({ error: 'Feed URL is required' }, 400);
  const validation = await validateExternalUrl(body.feedUrl, { resolveDns: false });
  if (!validation.ok) return c.json({ error: validation.reason }, 400);
  const result = await addRssFeed({
    userId,
    feedUrl: validation.url.href,
    title: typeof body.title === 'string' ? body.title : undefined,
    siteUrl: typeof body.siteUrl === 'string' ? body.siteUrl : undefined,
  });
  return c.json(result, result.existing ? 200 : 201);
});

rss.delete('/feeds/:id', async (c) => {
  const userId = await requireUser(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const deleted = await deleteRssFeed(userId, c.req.param('id'));
  return deleted ? c.json({ success: true }) : c.json({ error: 'Feed not found' }, 404);
});

rss.post('/import', async (c) => {
  const userId = await requireUser(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.opml !== 'string') return c.json({ error: 'OPML text is required' }, 400);

  let subscriptions: OpmlSubscription[];
  try {
    subscriptions = parseOpml(body.opml);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : 'Invalid OPML' }, 400);
  }

  let imported = 0;
  let existing = 0;
  let rejected = 0;
  for (let index = 0; index < subscriptions.length; index += OPML_IMPORT_CONCURRENCY) {
    const batch = subscriptions.slice(index, index + OPML_IMPORT_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (subscription) => {
        try {
          const validation = await validateExternalUrl(subscription.feedUrl, { resolveDns: false });
          if (!validation.ok) return 'rejected' as const;
          const result = await addRssFeed({
            userId,
            ...subscription,
            feedUrl: validation.url.href,
          });
          return result.existing ? ('existing' as const) : ('imported' as const);
        } catch {
          return 'rejected' as const;
        }
      })
    );
    for (const result of results) {
      if (result === 'existing') existing += 1;
      else if (result === 'imported') imported += 1;
      else rejected += 1;
    }
  }
  return c.json({ imported, existing, rejected, total: subscriptions.length });
});

rss.post('/refresh', async (c) => {
  const userId = await requireUser(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const feedId = typeof body.feedId === 'string' ? body.feedId : undefined;
  const results = await refreshRssFeeds(userId, feedId);
  if (feedId && results.length === 0) return c.json({ error: 'Feed not found' }, 404);
  return c.json({ results });
});

rss.get('/entries', async (c) => {
  const userId = await requireUser(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const feedId = c.req.query('feedId') || undefined;
  const unreadOnly = c.req.query('unread') === 'true';
  return c.json(await listRssEntries(userId, { feedId, unreadOnly }));
});

rss.patch('/entries/:id', async (c) => {
  const userId = await requireUser(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.read !== 'boolean') return c.json({ error: 'Read state is required' }, 400);
  const updated = await setRssEntryReadState(userId, c.req.param('id'), body.read);
  return updated ? c.json({ success: true }) : c.json({ error: 'Entry not found' }, 404);
});

rss.post('/entries/:id/save', async (c) => {
  const userId = await requireUser(c);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  const owned = await getOwnedRssEntry(userId, c.req.param('id'));
  if (!owned) return c.json({ error: 'Entry not found' }, 404);
  if (owned.entry.savedArticleId) return c.json({ id: owned.entry.savedArticleId, existing: true });
  if (!owned.entry.url) return c.json({ error: 'Entry has no URL to save' }, 400);

  let articleId = await findArticleByUrl(owned.entry.url, userId);
  const existing = Boolean(articleId);
  if (!articleId) {
    articleId = await createArticleRecord({
      userId,
      url: owned.entry.url,
      title: owned.entry.title,
      byline: owned.entry.author ?? undefined,
      content: owned.entry.content ?? '',
      type: owned.entry.content ? 'article' : 'link',
      tags: ['rss'],
    });
  }
  await linkRssEntryToArticle(owned.entry.id, articleId);
  return c.json({ id: articleId, existing });
});

export default rss;
