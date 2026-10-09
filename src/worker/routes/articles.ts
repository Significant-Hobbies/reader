import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';

import { getAuthenticatedUserId } from '../../lib/auth-api';
import { addLink, getLink, listLinks, setLinkRead } from '../../lib/links-db';
import type { WorkerEnv } from '../../lib/worker-env';

const links = new Hono<{ Bindings: WorkerEnv; Variables: { userId: string } }>();

links.use('*', async (c, next) => {
  const userId = await getAuthenticatedUserId(c.req.raw.headers, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);
  c.set('userId', userId);
  c.header('Cache-Control', 'private, no-store');
  await next();
});

links.use('*', bodyLimit({ maxSize: 8192 }));

links.get('/', async (c) => {
  const status = c.req.query('status');
  const offset = Number(c.req.query('offset') ?? 0);
  if (!Number.isSafeInteger(offset) || offset < 0) return c.json({ error: 'Invalid offset' }, 400);
  if (status && status !== 'read' && status !== 'unread')
    return c.json({ error: 'Invalid status' }, 400);
  return c.json(
    await listLinks(c.get('userId'), {
      query: c.req.query('q'),
      status: status === 'read' || status === 'unread' ? status : undefined,
      offset,
    })
  );
});

links.post('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return c.json({ error: 'Enter a URL.' }, 400);
  }
  try {
    // URL-only capture, including older extension payloads. No imports or AI calls.
    return c.json(await addLink(c.get('userId'), body), 200);
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error && /URL/u.test(error.message))) {
      return c.json({ error: error.message }, 400);
    }
    throw error;
  }
});

links.get('/:id', async (c) => {
  const item = await getLink(c.get('userId'), c.req.param('id'));
  if (!item) return c.json({ error: 'Link not found' }, 404);
  const { storedContent: _storedContent, ...link } = item;
  return c.json(link);
});

links.put('/:id', async (c) => {
  const body = await c.req.json().catch(() => null);
  const status = body?.status;
  if (status !== 'read' && status !== 'unread' && status !== 'in_progress') {
    return c.json({ error: 'Status must be read or unread.' }, 400);
  }
  const item = await setLinkRead(c.get('userId'), c.req.param('id'), status === 'read');
  return item ? c.json(item) : c.json({ error: 'Link not found' }, 404);
});

export default links;
