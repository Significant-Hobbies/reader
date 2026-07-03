import { Hono } from 'hono';

import { getAuthenticatedUserId } from '../../lib/auth-api';
import type { WorkerEnv } from '../../lib/worker-env';
import { deleteMemory, listMemories, searchMemories, updateMemory } from '../../lib/memories-db';

const memories = new Hono<{ Bindings: WorkerEnv }>();

// GET /api/memories — list the authenticated user's persisted captures.
memories.get('/', async (c) => {
  try {
    const userId = await getAuthenticatedUserId(c.req.raw.headers, c.env);
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    const rows = await listMemories(userId);
    return c.json(rows);
  } catch (error) {
    console.error('Error fetching memories:', error);
    return c.json({ error: 'Failed to fetch memories' }, 500);
  }
});

// GET /api/memories/search?q= — search the user's persisted captures.
memories.get('/search', async (c) => {
  try {
    const userId = await getAuthenticatedUserId(c.req.raw.headers, c.env);
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    const query = c.req.query('q') || '';
    if (!query || query.trim().length < 2) {
      return c.json({ results: [] });
    }

    const results = await searchMemories(userId, query);
    return c.json({ results });
  } catch (error) {
    console.error('Error searching memories:', error);
    return c.json({ error: 'Failed to search memories' }, 500);
  }
});

// PATCH /api/memories/:id — update tags and/or title for a owned capture.
memories.patch('/:id', async (c) => {
  try {
    const userId = await getAuthenticatedUserId(c.req.raw.headers, c.env);
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    if (!id) return c.json({ error: 'Memory id is required' }, 400);

    const body = await c.req.json().catch(() => ({}));
    const updates: { tags?: unknown; title?: unknown } = {};
    if (body?.tags !== undefined) updates.tags = body.tags;
    if (body?.title !== undefined) updates.title = body.title;

    if (Object.keys(updates).length === 0) {
      return c.json({ error: 'No updates provided' }, 400);
    }

    const updated = await updateMemory(id, userId, updates);
    if (!updated) return c.json({ error: 'Not found' }, 404);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error updating memory:', error);
    return c.json({ error: 'Failed to update memory' }, 500);
  }
});

// DELETE /api/memories/:id — delete an owned capture.
memories.delete('/:id', async (c) => {
  try {
    const userId = await getAuthenticatedUserId(c.req.raw.headers, c.env);
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    if (!id) return c.json({ error: 'Memory id is required' }, 400);

    const deleted = await deleteMemory(id, userId);
    if (!deleted) return c.json({ error: 'Not found' }, 404);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting memory:', error);
    return c.json({ error: 'Failed to delete memory' }, 500);
  }
});

export default memories;
