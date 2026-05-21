'use client';

import type { ReactNode } from 'react';
import { useEffect } from 'react';

import { trackReturnedOnce, trackSignupOnce } from '@/lib/analytics';
import { signIn, signOut, useSession } from '@/lib/auth-client';

/**
 * Session-level analytics wiring. `signup` fires once per browser the first
 * time a signed-in user is observed; `returned` fires once per session for a
 * user with prior activity. `activated` / `core_action` are emitted at their
 * real trigger points (HomeClient save mutations, ArticleSummary).
 */
function AnalyticsTracker() {
  const { data: session, isPending } = useSession();
  useEffect(() => {
    if (isPending) return;
    if (session?.user) {
      trackSignupOnce();
    }
    // `returned` self-gates on prior activity + per-session.
    trackReturnedOnce();
  }, [session?.user, isPending]);
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // better-auth manages its own session state via cookies — no wrapper needed
  return (
    <>
      <AnalyticsTracker />
      {children}
    </>
  );
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
