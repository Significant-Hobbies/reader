'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { trackReturnedOnce, trackSignupOnce } from '@/lib/analytics';

type AuthClientModule = typeof import('@/lib/auth-client');

type AuthUser = {
  id: string | null;
  email: string | null;
  name: string | null;
  image: string | null;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  signInWithGoogle: () => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function AnalyticsTracker({ useSession }: { useSession: AuthClientModule['useSession'] }) {
  const { data: session, isPending } = useSession();
  useEffect(() => {
    if (isPending) return;
    if (session?.user) {
      trackSignupOnce();
    }
    trackReturnedOnce();
  }, [session?.user, isPending]);
  return null;
}

function AuthProviderReady({ auth, children }: { auth: AuthClientModule; children: ReactNode }) {
  const { data: session, isPending } = auth.useSession();
  const sessionUser = session?.user;

  const value = useMemo<AuthContextValue>(
    () => ({
      user: sessionUser
        ? {
            id: sessionUser.id ?? null,
            email: sessionUser.email ?? null,
            name: sessionUser.name ?? null,
            image: sessionUser.image ?? null,
          }
        : null,
      loading: isPending,
      signInWithGoogle: () => auth.signIn.social({ provider: 'google', callbackURL: '/' }),
      logout: async () => {
        await auth.signOut({
          fetchOptions: {
            onSuccess: () => {
              window.location.href = '/login';
            },
          },
        });
      },
    }),
    [auth, isPending, sessionUser]
  );

  return (
    <AuthContext.Provider value={value}>
      <AnalyticsTracker useSession={auth.useSession} />
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthClientModule | null>(null);

  useEffect(() => {
    void import('@/lib/auth-client').then(setAuth);
  }, []);

  const bootValue = useMemo<AuthContextValue>(
    () => ({
      user: null,
      loading: true,
      signInWithGoogle: () => {
        void import('@/lib/auth-client').then((mod) =>
          mod.signIn.social({ provider: 'google', callbackURL: '/' })
        );
      },
      logout: async () => {
        const mod = await import('@/lib/auth-client');
        await mod.signOut({
          fetchOptions: {
            onSuccess: () => {
              window.location.href = '/login';
            },
          },
        });
      },
    }),
    []
  );

  if (!auth) {
    return <AuthContext.Provider value={bootValue}>{children}</AuthContext.Provider>;
  }

  return <AuthProviderReady auth={auth}>{children}</AuthProviderReady>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
