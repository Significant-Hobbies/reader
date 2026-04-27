import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getAuthenticatedUserId } from '@/lib/auth-api';
import { db } from '@/lib/db/client';
import { users } from '@/lib/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    uid: user.id,
    email: user.email ?? null,
    displayName: user.name ?? null,
    photoURL: user.image ?? null,
  });
}
