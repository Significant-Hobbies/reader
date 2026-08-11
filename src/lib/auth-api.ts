import { API_KEY_PREFIX, verifyApiKey } from './api-keys';
import { createAuth, type AuthEnv } from './auth';
import {
  findReaderUserByGoogleId,
  type ReaderAuth0Env,
  verifyReaderAuth0Subject,
} from './auth0-mcp';

export type McpAuthResult =
  | { status: 'authorized'; userId: string }
  | { status: 'account_not_found' }
  | { status: 'invalid' };

/** Resolve only a dedicated long-lived Reader API key; never use browser auth. */
export async function getApiKeyUserId(headers: Headers): Promise<string | null> {
  const authHeader = headers.get('authorization') ?? headers.get('Authorization');
  if (!authHeader) return null;
  const [scheme, value, extra] = authHeader.trim().split(/\s+/, 3);
  if (
    extra !== undefined ||
    scheme?.toLowerCase() !== 'bearer' ||
    !value?.startsWith(API_KEY_PREFIX)
  ) {
    return null;
  }
  return verifyApiKey(value);
}

/** Resolve a Reader PAT or a short-lived, user-specific Auth0 MCP token. */
export async function authenticateMcpReader(
  headers: Headers,
  env: ReaderAuth0Env
): Promise<McpAuthResult> {
  const authHeader = headers.get('authorization') ?? headers.get('Authorization');
  if (!authHeader) return { status: 'invalid' };
  const [scheme, value, extra] = authHeader.trim().split(/\s+/, 3);
  if (extra !== undefined || scheme?.toLowerCase() !== 'bearer' || !value) {
    return { status: 'invalid' };
  }
  if (value.startsWith(API_KEY_PREFIX)) {
    const userId = await verifyApiKey(value);
    return userId ? { status: 'authorized', userId } : { status: 'invalid' };
  }
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(value)) {
    return { status: 'invalid' };
  }
  const googleId = await verifyReaderAuth0Subject(value, env);
  if (!googleId) return { status: 'invalid' };
  const userId = await findReaderUserByGoogleId(googleId);
  return userId ? { status: 'authorized', userId } : { status: 'account_not_found' };
}

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
      const userId = await getApiKeyUserId(headers);
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
