import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { getAuthenticatedUserId } from '../../lib/auth-api';
import { db } from '../../lib/db/client';
import { users } from '../../lib/db/schema';
import type { WorkerEnv } from '../../lib/worker-env';

const misc = new Hono<{ Bindings: WorkerEnv }>();

misc.get('/auth/me', async (c) => {
  const userId = await getAuthenticatedUserId(c.req.raw.headers, c.env);
  if (!userId) return c.json({ error: 'Unauthorized' }, 401);

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return c.json({ error: 'Unauthorized' }, 401);

  return c.json({
    uid: user.id,
    email: user.email ?? null,
    displayName: user.name ?? null,
    photoURL: user.image ?? null,
  });
});

export default misc;
