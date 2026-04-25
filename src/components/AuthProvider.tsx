'use client';

import { ReactNode } from 'react';
import { SessionProvider, signIn, signOut, useSession } from 'next-auth/react';

export function AuthProvider({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}

export type AuthUser = {
  id: string | null;
  email: string | null;
  name: string | null;
  image: string | null;
};

/**
 * Auth.js-backed replacement for the previous Firebase-based `useAuth()` hook.
 * Preserves the `{ user, loading, signInWithGoogle, logout }` shape.
 * Note: `user.photoURL` → `user.image` and `user.uid` → `user.id` on the
 * Auth.js side; any downstream UI using the old Firebase field names must be
 * updated alongside this change.
 */
export function useAuth() {
  const { data: session, status } = useSession();
  const sessionUser = session?.user;

  const user: AuthUser | null = sessionUser
    ? {
        id: sessionUser.id ?? null,
        email: sessionUser.email ?? null,
        name: sessionUser.name ?? null,
        image: sessionUser.image ?? null,
      }
    : null;

  return {
    user,
    loading: status === 'loading',
    signInWithGoogle: () => signIn('google', { callbackUrl: '/' }),
    logout: () => signOut({ callbackUrl: '/login' }),
  };
}
