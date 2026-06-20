import { desc, eq } from 'drizzle-orm';
import { and, isNull } from 'drizzle-orm';
import { Hono } from 'hono';

import { generateApiKey } from '../../lib/api-keys';
import { requireSessionUserId } from '../../lib/auth-api';
import { db } from '../../lib/db/client';
import { apiKeys } from '../../lib/db/schema';
import type { WorkerEnv } from '../../lib/worker-env';

const keys = new Hono<{ Bindings: WorkerEnv }>();

keys.get('/', async (c) => {
  const userId = await requireSessionUserId(c.req.raw.headers, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const rows = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      prefix: apiKeys.prefix,
      createdAt: apiKeys.createdAt,
      lastUsedAt: apiKeys.lastUsedAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(desc(apiKeys.createdAt));

  return c.json(rows);
});

keys.post('/', async (c) => {
  const userId = await requireSessionUserId(c.req.raw.headers, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const body = (await c.req.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return c.json({ error: 'name is required' }, 400);
  }
  if (name.length > 80) {
    return c.json({ error: 'name too long' }, 400);
  }

  const { plaintext, hash, prefix } = generateApiKey();
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(apiKeys).values({
    id,
    userId,
    name,
    tokenHash: hash,
    prefix,
    createdAt: now,
  });

  return c.json(
    {
      id,
      name,
      prefix,
      token: plaintext,
      createdAt: now.getTime(),
    },
    201
  );
});

keys.delete('/:id', async (c) => {
  const userId = await requireSessionUserId(c.req.raw.headers, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');

  const result = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
    .returning({ id: apiKeys.id });

  if (result.length === 0) {
    return c.json({ error: 'Not found' }, 404);
  }

  return c.json({ id: result[0].id, revoked: true });
});

export default keys;
