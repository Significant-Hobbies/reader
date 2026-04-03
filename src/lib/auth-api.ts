import * as admin from 'firebase-admin';
import { cookies, headers } from 'next/headers';
import { ensureFirebaseAdmin } from './firebase-admin';

const SESSION_COOKIE_NAME = '__session';

export async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    ensureFirebaseAdmin();

    // Check session cookie first (web app)
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (sessionCookie) {
      const decoded = await admin.auth().verifySessionCookie(sessionCookie, true);
      return decoded.uid;
    }

    // Fall back to Authorization header (Chrome extension)
    const headerStore = await headers();
    const authHeader = headerStore.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const decoded = await admin.auth().verifySessionCookie(token, true);
      return decoded.uid;
    }

    return null;
  } catch (error) {
    console.error('Session verification failed:', error);
    return null;
  }
}
