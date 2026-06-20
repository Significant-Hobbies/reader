import { Hono } from 'hono';

import { getAuthenticatedUserId } from '../../lib/auth-api';
import { createList, deleteList, fetchLists, updateList } from '../../lib/lists-db';
import type { WorkerEnv } from '../../lib/worker-env';

const lists = new Hono<{ Bindings: WorkerEnv }>();

lists.get('/', async (c) => {
  try {
    const userId = await getAuthenticatedUserId(c.req.raw.headers, c.env);
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    const rows = await fetchLists(userId);
    return c.json(rows);
  } catch (error) {
    console.error('Error fetching lists:', error);
    return c.json({ error: 'Failed to fetch lists' }, 500);
  }
});

lists.post('/', async (c) => {
  try {
    const userId = await getAuthenticatedUserId(c.req.raw.headers, c.env);
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json();
    const { name, color } = body || {};

    if (typeof name !== 'string' || !name.trim()) {
      return c.json({ error: 'List name is required' }, 400);
    }

    const id = await createList(name, userId, color);
    return c.json({ id });
  } catch (error) {
    console.error('Error creating list:', error);
    return c.json({ error: 'Failed to create list' }, 500);
  }
});

lists.put('/:id', async (c) => {
  try {
    const userId = await getAuthenticatedUserId(c.req.raw.headers, c.env);
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    if (!id) return c.json({ error: 'List id is required' }, 400);

    const body = await c.req.json();
    const { name, color } = body || {};

    const updates: { name?: string; color?: string } = {};
    if (name !== undefined) updates.name = name;
    if (color !== undefined) updates.color = color;

    if (Object.keys(updates).length === 0) {
      return c.json({ error: 'No updates provided' }, 400);
    }

    await updateList(id, userId, updates);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error updating list:', error);

    if (error instanceof Error) {
      if (error.message === 'Cannot edit default lists') {
        return c.json({ error: error.message }, 400);
      }
      if (error.message === 'Unauthorized') {
        return c.json({ error: 'Unauthorized' }, 403);
      }
      if (error.message === 'List name is required') {
        return c.json({ error: error.message }, 400);
      }
    }

    return c.json({ error: 'Failed to update list' }, 500);
  }
});

lists.delete('/:id', async (c) => {
  try {
    const userId = await getAuthenticatedUserId(c.req.raw.headers, c.env);
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    if (!id) return c.json({ error: 'List id is required' }, 400);

    await deleteList(id, userId);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting list:', error);

    if (error instanceof Error) {
      if (error.message === 'Cannot delete default lists') {
        return c.json({ error: error.message }, 400);
      }
      if (error.message === 'Unauthorized') {
        return c.json({ error: 'Unauthorized' }, 403);
      }
    }

    return c.json({ error: 'Failed to delete list' }, 500);
  }
});

export default lists;
