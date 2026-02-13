import * as admin from 'firebase-admin';
import { cookies } from 'next/headers';
import { ensureFirebaseAdmin } from './firebase-admin';

const SESSION_COOKIE_NAME = '__session';

export async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    ensureFirebaseAdmin();
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) return null;
    const decoded = await admin.auth().verifySessionCookie(sessionCookie, true);
    return decoded.uid;
  } catch (error) {
    console.error('Session verification failed:', error);
    return null;
  }
}
