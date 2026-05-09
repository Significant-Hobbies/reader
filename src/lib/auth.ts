import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

import { db } from './db/client';
import { baAccounts, baSessions, baVerifications, users } from './db/schema';

const canUseLocalAuthSecret =
  process.env.NODE_ENV !== 'production' ||
  process.env.npm_lifecycle_event === 'build' ||
  process.env.NEXT_PHASE === 'phase-production-build';

const authSecret =
  process.env.BETTER_AUTH_SECRET?.trim() ||
  process.env.AUTH_SECRET?.trim() ||
  (canUseLocalAuthSecret ? 'reader-local-development-secret-at-least-32-chars' : undefined);
const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

export const auth = betterAuth({
  secret: authSecret,
  baseURL: process.env.BETTER_AUTH_URL || 'https://reader.sarthakagrawal927.workers.dev',
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: {
      user: users,
      session: baSessions,
      account: baAccounts,
      verification: baVerifications,
    },
  }),
  socialProviders:
    googleClientId && googleClientSecret
      ? { google: { clientId: googleClientId, clientSecret: googleClientSecret } }
      : {},
  rateLimit: {
    enabled: false,
  },
});
