import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db, schema } from './db/client';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: schema.users,
    accountsTable: schema.accounts,
    sessionsTable: schema.sessions,
    verificationTokensTable: schema.verificationTokens,
  }),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Safe here: only one provider (Google) and no email/password sign-in,
      // so linking by verified email cannot be weaponized for account takeover.
      // Required so the migrated user row (seeded without an accounts entry)
      // links on first sign-in instead of throwing OAuthAccountNotLinked.
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  session: { strategy: 'database' },
  pages: { signIn: '/login' },
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});
