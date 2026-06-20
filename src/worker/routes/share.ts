import { Hono } from 'hono';

import { fetchArticleByShareId } from '../../lib/articles-db';
import { fetchBoardByShareId } from '../../lib/boards-db';
import type { WorkerEnv } from '../../lib/worker-env';

const SHARE_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;

const share = new Hono<{ Bindings: WorkerEnv }>();

share.get('/article/:shareId', async (c) => {
  try {
    const shareId = c.req.param('shareId');
    if (!shareId || !SHARE_ID_PATTERN.test(shareId)) {
      return c.json({ error: 'Invalid share link' }, 400);
    }

    const article = await fetchArticleByShareId(shareId);
    if (!article) return c.json({ error: 'Article not found' }, 404);

    return c.json(article);
  } catch (error) {
    console.error('Error fetching shared article:', error);
    return c.json({ error: 'Failed to fetch article' }, 500);
  }
});

share.get('/:shareId', async (c) => {
  try {
    const shareId = c.req.param('shareId');
    if (!shareId || !SHARE_ID_PATTERN.test(shareId)) {
      return c.json({ error: 'Invalid share link' }, 400);
    }

    const board = await fetchBoardByShareId(shareId);
    if (!board) return c.json({ error: 'Board not found' }, 404);

    return c.json(board);
  } catch (error) {
    console.error('Error fetching shared board:', error);
    return c.json({ error: 'Failed to fetch board' }, 500);
  }
});

export default share;
