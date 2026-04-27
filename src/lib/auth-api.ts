import { headers } from 'next/headers';

import { API_KEY_PREFIX, verifyApiKey } from './api-keys';
import { auth } from './auth';

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
  let h: Awaited<ReturnType<typeof headers>>;
  try {
    h = await headers();
  } catch {
    // `headers()` throws outside a request scope (e.g. during build)
    return null;
  }

  const authHeader = h.get('authorization') ?? h.get('Authorization');
  if (authHeader) {
    const [scheme, value] = authHeader.split(' ', 2);
    if (scheme?.toLowerCase() === 'bearer' && value?.startsWith(API_KEY_PREFIX)) {
      const userId = await verifyApiKey(value);
      if (userId) return userId;
      // Explicit bearer present but invalid — don't silently fall through.
      return null;
    }
  }

  const session = await auth.api.getSession({ headers: h });
  return session?.user?.id ?? null;
}
