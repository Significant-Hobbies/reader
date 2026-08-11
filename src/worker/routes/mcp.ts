import { Hono } from 'hono';

import { fetchArticleById, searchArticleSummaries } from '../../lib/articles-db';
import { authenticateMcpReader } from '../../lib/auth-api';
import { fetchLists } from '../../lib/lists-db';
import type { WorkerEnv } from '../../lib/worker-env';

const mcpReads = new Hono<{ Bindings: WorkerEnv }>();

function pageValue(value: string | undefined, fallback: number, max: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, 0), max) : fallback;
}

async function ownerId(headers: Headers, env: WorkerEnv) {
  return authenticateMcpReader(headers, env);
}

function authError(result: Awaited<ReturnType<typeof ownerId>>) {
  return result.status === 'account_not_found'
    ? {
        status: 403 as const,
        body: {
          code: 'ACCOUNT_NOT_FOUND',
          message: 'Sign in to Reader with the same Google account first.',
        },
      }
    : {
        status: 401 as const,
        body: { code: 'UNAUTHORIZED', message: 'Read credential required.' },
      };
}

mcpReads.get('/reading', async (c) => {
  const auth = await ownerId(c.req.raw.headers, c.env);
  if (auth.status !== 'authorized') {
    const error = authError(auth);
    return c.json(error.body, error.status);
  }
  const userId = auth.userId;
  const type = c.req.query('type');
  const result = await searchArticleSummaries(userId, {
    query: c.req.query('q'),
    listId: c.req.query('listId'),
    projectId: c.req.query('projectId'),
    type: type === 'article' || type === 'link' || type === 'pdf' ? type : undefined,
    limit: Math.max(1, pageValue(c.req.query('limit'), 10, 50)),
    offset: pageValue(c.req.query('offset'), 0, 1_000_000),
  });
  return c.json({ ...result, generatedAt: new Date().toISOString() });
});

mcpReads.get('/reading/:id', async (c) => {
  const auth = await ownerId(c.req.raw.headers, c.env);
  if (auth.status !== 'authorized') {
    const error = authError(auth);
    return c.json(error.body, error.status);
  }
  const userId = auth.userId;
  const article = await fetchArticleById(c.req.param('id'), userId);
  if (!article) return c.json({ code: 'NOT_FOUND', message: 'Saved item not found.' }, 404);
  const item = {
    id: article.id,
    url: article.url,
    title: article.title,
    byline: article.byline,
    content: article.content,
    status: article.status,
    tags: article.tags,
    notes: article.notes,
    summary: article.aiSummary,
    keyPoints: article.keyPoints,
    type: article.type,
    category: article.category,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
    listIds: article.listIds,
  };
  return c.json({ item });
});

mcpReads.get('/collections', async (c) => {
  const auth = await ownerId(c.req.raw.headers, c.env);
  if (auth.status !== 'authorized') {
    const error = authError(auth);
    return c.json(error.body, error.status);
  }
  const userId = auth.userId;
  const limit = Math.max(1, pageValue(c.req.query('limit'), 10, 50));
  const offset = pageValue(c.req.query('offset'), 0, 1_000_000);
  const lists = await fetchLists(userId);
  const items = lists.slice(offset, offset + limit).map((list) => ({
    id: list.id,
    name: list.name,
    color: list.color,
    isDefault: list.isDefault,
    createdAt: list.createdAt,
    updatedAt: list.updatedAt,
  }));
  return c.json({
    generatedAt: new Date().toISOString(),
    items,
    total: lists.length,
    nextOffset: offset + items.length < lists.length ? offset + items.length : null,
  });
});

export default mcpReads;
