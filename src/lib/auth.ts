import { getCloudflareContext } from '@opennextjs/cloudflare';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

import { db } from './db/client';
import { baAccounts, baSessions, baVerifications, users } from './db/schema';

function readRuntimeEnv(name: string): string | undefined {
  const fromProcess = process.env[name]?.trim();
  if (fromProcess) return fromProcess;

  try {
    const { env } = getCloudflareContext({ async: false });
    const value = (env as Record<string, unknown>)[name];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  } catch {
    return undefined;
  }
}

const canUseLocalAuthSecret =
  process.env.NODE_ENV !== 'production' ||
  process.env.npm_lifecycle_event === 'build' ||
  process.env.NEXT_PHASE === 'phase-production-build';

const authSecret =
  readRuntimeEnv('BETTER_AUTH_SECRET') ||
  readRuntimeEnv('AUTH_SECRET') ||
  (canUseLocalAuthSecret ? 'reader-local-development-secret-at-least-32-chars' : undefined);

export const auth = betterAuth({
  secret: authSecret,
  baseURL: readRuntimeEnv('BETTER_AUTH_URL') || 'https://reader.sarthakagrawal927.workers.dev',
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: {
      user: users,
      session: baSessions,
      account: baAccounts,
      verification: baVerifications,
    },
  }),
  socialProviders: {
    google: () => {
      const clientId = readRuntimeEnv('GOOGLE_CLIENT_ID');
      const clientSecret = readRuntimeEnv('GOOGLE_CLIENT_SECRET');
      return clientId && clientSecret
        ? { clientId, clientSecret }
        : { enabled: false, clientId: '', clientSecret: '' };
    },
  },
  rateLimit: {
    enabled: false,
  },
});
