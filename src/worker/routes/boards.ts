import { Hono } from 'hono';

import { getAuthenticatedUserId } from '../../lib/auth-api';
import {
  createBoard,
  deleteBoard,
  fetchBoardById,
  fetchBoardSummaries,
  generateShareId,
  revokeShareId,
  updateBoard,
  verifyBoardOwnership,
} from '../../lib/boards-db';
import type { WorkerEnv } from '../../lib/worker-env';

const boards = new Hono<{ Bindings: WorkerEnv }>();

boards.get('/', async (c) => {
  try {
    const userId = await getAuthenticatedUserId(c.req.raw.headers, c.env);
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    const summaries = await fetchBoardSummaries(userId);
    return c.json(summaries);
  } catch (error) {
    console.error('Error fetching boards:', error);
    return c.json({ error: 'Failed to fetch boards' }, 500);
  }
});

boards.post('/', async (c) => {
  try {
    const userId = await getAuthenticatedUserId(c.req.raw.headers, c.env);
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json();
    const { name } = body || {};

    if (!name || typeof name !== 'string') {
      return c.json({ error: 'Board name is required' }, 400);
    }

    const id = await createBoard(name, userId);
    return c.json({ id });
  } catch (error) {
    console.error('Error creating board:', error);
    return c.json({ error: 'Failed to create board' }, 500);
  }
});

boards.get('/:id', async (c) => {
  try {
    const userId = await getAuthenticatedUserId(c.req.raw.headers, c.env);
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const board = await fetchBoardById(id, userId);
    if (!board) return c.json({ error: 'Board not found' }, 404);

    return c.json(board);
  } catch (error) {
    console.error('Error fetching board:', error);
    return c.json({ error: 'Failed to fetch board' }, 500);
  }
});

boards.put('/:id', async (c) => {
  try {
    const userId = await getAuthenticatedUserId(c.req.raw.headers, c.env);
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const isOwner = await verifyBoardOwnership(id, userId);
    if (!isOwner) return c.json({ error: 'Not found or not authorized' }, 404);

    const body = await c.req.json();
    if (typeof body !== 'object' || body === null) {
      return c.json({ error: 'Invalid request body' }, 400);
    }

    const payload = body as Record<string, unknown>;

    if (payload.shareAction === 'generate') {
      const shareId = await generateShareId(id, userId);
      if (!shareId) return c.json({ error: 'Failed to generate share link' }, 500);
      return c.json({ shareId });
    }

    if (payload.shareAction === 'revoke') {
      await revokeShareId(id, userId);
      return c.json({ success: true });
    }

    await updateBoard(id, userId, payload);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error updating board:', error);
    return c.json({ error: 'Failed to update board' }, 500);
  }
});

boards.delete('/:id', async (c) => {
  try {
    const userId = await getAuthenticatedUserId(c.req.raw.headers, c.env);
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    const isOwner = await verifyBoardOwnership(id, userId);
    if (!isOwner) return c.json({ error: 'Not found or not authorized' }, 404);

    await deleteBoard(id, userId);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting board:', error);
    return c.json({ error: 'Failed to delete board' }, 500);
  }
});

export default boards;
