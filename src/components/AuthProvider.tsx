'use client';

import type { ReactNode } from 'react';

import { signIn, signOut, useSession } from '@/lib/auth-client';

export function AuthProvider({ children }: { children: ReactNode }) {
  // better-auth manages its own session state via cookies — no wrapper needed
  return <>{children}</>;
}

export type AuthUser = {
  id: string | null;
  email: string | null;
  name: string | null;
  image: string | null;
};

/**
 * better-auth session hook. Preserves the `{ user, loading, signInWithGoogle, logout }` shape.
 */
export function useAuth() {
  const { data: session, isPending } = useSession();
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
    loading: isPending,
    signInWithGoogle: () => signIn.social({ provider: 'google', callbackURL: '/' }),
    logout: () =>
      signOut({
        fetchOptions: {
          onSuccess: () => {
            window.location.href = '/login';
          },
        },
      }),
  };
}
