import { NextResponse } from 'next/server';
import * as admin from 'firebase-admin';
import { getAuthenticatedUserId } from '@/lib/auth-api';
import { ensureFirebaseAdmin } from '@/lib/firebase-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const uid = await getAuthenticatedUserId();
  if (!uid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    ensureFirebaseAdmin();
    const user = await admin.auth().getUser(uid);

    return NextResponse.json({
      uid: user.uid,
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      photoURL: user.photoURL ?? null,
    });
  } catch (error) {
    console.error('Failed to fetch user record:', error);
    return NextResponse.json({ error: 'Failed to fetch user info' }, { status: 500 });
  }
}
