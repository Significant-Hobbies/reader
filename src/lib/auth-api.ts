import { API_KEY_PREFIX, verifyApiKey } from './api-keys';
import { createAuth, type AuthEnv } from './auth';

/**
 * Resolve the authenticated user for an API request.
 *
 * Priority:
 *   1. `Authorization: Bearer rdr_*` — long-lived API key (chrome extension).
 *   2. better-auth session cookie — webapp users.
 *
 * The bearer path lets the chrome extension survive session cookie expiry.
 */
export async function getAuthenticatedUserId(
  headers: Headers,
  env: AuthEnv
): Promise<string | null> {
  const authHeader = headers.get('authorization') ?? headers.get('Authorization');
  if (authHeader) {
    const [scheme, value] = authHeader.split(' ', 2);
    if (scheme?.toLowerCase() === 'bearer' && value?.startsWith(API_KEY_PREFIX)) {
      const userId = await verifyApiKey(value);
      if (userId) return userId;
      return null;
    }
  }

  const auth = createAuth(env);
  const session = await auth.api.getSession({ headers });
  return session?.user?.id ?? null;
}

export async function requireSessionUserId(headers: Headers, env: AuthEnv): Promise<string | null> {
  const auth = createAuth(env);
  const session = await auth.api.getSession({ headers });
  return session?.user?.id ?? null;
}
