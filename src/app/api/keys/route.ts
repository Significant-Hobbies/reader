import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/lib/db/client';
import { apiKeys } from '@/lib/db/schema';
import { generateApiKey } from '@/lib/api-keys';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// API-key management is session-only: an API key cannot manage API keys.
async function requireSessionUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

export async function GET() {
  const userId = await requireSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const userId = await requireSessionUserId();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (name.length > 80) {
    return NextResponse.json({ error: 'name too long' }, { status: 400 });
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

  return NextResponse.json(
    {
      id,
      name,
      prefix,
      token: plaintext, // shown once — client must store it now
      createdAt: now.getTime(),
    },
    { status: 201 }
  );
}
