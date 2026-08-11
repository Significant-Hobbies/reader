import { and, eq } from 'drizzle-orm';
import { verifyWithJwks } from 'hono/jwt';

import { db } from './db/client';
import { accounts, baAccounts } from './db/schema';

const REQUIRED_SCOPE = 'reader.read';
const MAX_TOKEN_LIFETIME_SECONDS = 3_600;
const GOOGLE_SUBJECT = /^google-oauth2\|([A-Za-z0-9._-]{3,256})$/u;

type JwksOptions = Parameters<typeof verifyWithJwks>[1];
export type ReaderAuth0Env = {
  AUTH0_ISSUER?: string;
  AUTH0_MCP_AUDIENCE?: string;
};

function auth0Issuer(value: string | undefined): string | null {
  try {
    const url = new URL(value ?? '');
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== '/' ||
      url.search ||
      url.hash ||
      !url.hostname.endsWith('.auth0.com')
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

function exactAudience(value: string | undefined): string | null {
  try {
    const url = new URL(value ?? '');
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      url.pathname !== '/reader/mcp'
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

function stringClaims(value: unknown): string[] {
  if (typeof value === 'string') return value.split(/\s+/u).filter(Boolean);
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value;
  return [];
}

export async function verifyReaderAuth0Subject(
  token: string,
  env: ReaderAuth0Env,
  keys?: JwksOptions['keys']
): Promise<string | null> {
  const issuer = auth0Issuer(env.AUTH0_ISSUER);
  const audience = exactAudience(env.AUTH0_MCP_AUDIENCE);
  if (!issuer || !audience) return null;
  try {
    const payload = await verifyWithJwks(
      token,
      {
        ...(keys ? { keys } : { jwks_uri: new URL('.well-known/jwks.json', issuer).href }),
        allowedAlgorithms: ['RS256'],
        verification: { iss: issuer, aud: audience },
      },
      { cf: { cacheEverything: true, cacheTtl: 3_600 } } as RequestInit
    );
    const match = typeof payload.sub === 'string' ? GOOGLE_SUBJECT.exec(payload.sub) : null;
    const permissions = new Set([
      ...stringClaims(payload.scope),
      ...stringClaims(payload.scopes),
      ...stringClaims(payload.permissions),
    ]);
    if (
      !match ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number' ||
      payload.exp <= payload.iat ||
      payload.exp - payload.iat > MAX_TOKEN_LIFETIME_SECONDS ||
      !permissions.has(REQUIRED_SCOPE)
    ) {
      return null;
    }
    return match[1] ?? null;
  } catch {
    return null;
  }
}

export async function findReaderUserByGoogleId(googleId: string): Promise<string | null> {
  const [betterAuthAccount] = await db
    .select({ userId: baAccounts.userId })
    .from(baAccounts)
    .where(and(eq(baAccounts.providerId, 'google'), eq(baAccounts.accountId, googleId)))
    .limit(1);
  if (betterAuthAccount?.userId) return betterAuthAccount.userId;

  const [legacyAccount] = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(and(eq(accounts.provider, 'google'), eq(accounts.providerAccountId, googleId)))
    .limit(1);
  return legacyAccount?.userId ?? null;
}
