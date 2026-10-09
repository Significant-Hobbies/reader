'use client';

import { useEffect, useState } from 'react';

import { signIn, startGoogleOneTap } from '@/lib/auth-client';
import { captureAuthFailure } from '@/lib/foundry-monitoring';

import { Button } from './ui/button';

export default function LoginClient() {
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    void startGoogleOneTap('/library').catch((error) => {
      captureAuthFailure({
        provider: 'google',
        stage: 'one-tap',
        reason: error instanceof Error ? error.message : 'Google One Tap failed',
        source: 'login-client',
      });
    });
  }, []);

  const handleSignIn = async () => {
    setError(null);
    setSigningIn(true);
    try {
      setRedirecting(true);
      const result = await signIn.social({ provider: 'google', callbackURL: '/' });
      if (result?.error) {
        captureAuthFailure({
          provider: 'google',
          stage: 'signin',
          reason: result.error.message ?? 'Google sign-in failed',
          source: 'login-client',
        });
        setError('Failed to sign in. Please try again.');
        setSigningIn(false);
        setRedirecting(false);
      }
    } catch (err) {
      captureAuthFailure({
        provider: 'google',
        stage: 'signin',
        reason: err instanceof Error ? err.message : 'Google sign-in failed',
        source: 'login-client',
      });
      console.error('Sign-in error:', err);
      setError('Failed to sign in. Please try again.');
      setSigningIn(false);
      setRedirecting(false);
    }
  };

  if (redirecting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#15130f]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--accent-10)]" />
          <p className="text-[var(--gray-11)]">Loading your library...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-[#15130f] bg-[radial-gradient(circle_at_top,rgba(180,140,92,0.16),transparent_30rem)] p-8 lg:flex-row lg:items-center lg:gap-16">
      <div className="w-full max-w-md rounded-xl border border-[var(--gray-5)] bg-[var(--gray-2)]/85 p-8 text-center shadow-[0_24px_90px_rgba(0,0,0,0.35)]">
        <div className="mb-8">
          <p className="mb-2 text-sm font-medium tracking-wide text-[var(--gray-11)] uppercase">
            Saved-link inbox
          </p>
          <h1 className="text-4xl font-bold text-[var(--gray-12)]">Reader</h1>
          <p className="mt-3 text-base text-[var(--gray-11)]">
            Save links from the web. Retrieve them and track what you’ve read through ChatGPT.
          </p>
        </div>

        <Button
          size="lg"
          onClick={handleSignIn}
          disabled={signingIn}
          className="w-full justify-center"
        >
          {signingIn ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Signing in...
            </span>
          ) : (
            'Sign in with Google'
          )}
        </Button>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
