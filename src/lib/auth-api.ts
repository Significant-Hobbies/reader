import { headers } from 'next/headers';
import { auth } from './auth';
import { API_KEY_PREFIX, verifyApiKey } from './api-keys';

/**
 * Resolve the authenticated user for an API request.
 *
 * Priority:
 *   1. `Authorization: Bearer rdr_*` — long-lived API key (chrome extension).
 *   2. Auth.js session cookie — webapp users.
 *
 * The bearer path lets the chrome extension survive session cookie expiry.
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const h = await headers();
    const authHeader = h.get('authorization') ?? h.get('Authorization');
    if (authHeader) {
      const [scheme, value] = authHeader.split(' ', 2);
      if (scheme?.toLowerCase() === 'bearer' && value?.startsWith(API_KEY_PREFIX)) {
        const userId = await verifyApiKey(value);
        if (userId) return userId;
        // Explicit bearer present but invalid — don't silently fall through to
        // a session cookie; the caller is claiming API-key auth.
        return null;
      }
    }
  } catch {
    // `headers()` throws outside a request scope (e.g. during build); fall
    // through to the session path.
  }

  const session = await auth();
  return session?.user?.id ?? null;
}
