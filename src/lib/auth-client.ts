import { createAuthClient } from 'better-auth/react';

export const { useSession, signIn, signOut } = createAuthClient({
  baseURL:
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.BETTER_AUTH_URL || 'https://read.significanthobbies.com',
});
