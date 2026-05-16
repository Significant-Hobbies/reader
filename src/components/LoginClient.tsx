'use client';

import { Box, Button as ThemeButton, Card, Heading, Text } from '@radix-ui/themes';
import { useState } from 'react';

import { signIn } from '@/lib/auth-client';
import { captureAuthFailure } from '@/lib/foundry-monitoring';

export default function LoginClient() {
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

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
          <Text color="gray">Loading your library...</Text>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#15130f] bg-[radial-gradient(circle_at_top,rgba(180,140,92,0.16),transparent_30rem)] p-8">
      <Card className="w-full max-w-md border border-[var(--gray-5)] bg-[var(--gray-2)]/85 p-8 text-center shadow-[0_24px_90px_rgba(0,0,0,0.35)]">
        <Box className="mb-8">
          <Text as="p" size="2" weight="medium" color="gray" className="mb-2 uppercase">
            Personal research library
          </Text>
          <Heading as="h1" size="8" className="text-[var(--gray-12)]">
            Library
          </Heading>
          <Text as="p" size="3" color="gray" className="mt-3">
            Sign in to organize imported articles, outside links, and research PDFs.
          </Text>
        </Box>

        <ThemeButton
          size="3"
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
        </ThemeButton>

        {error && (
          <Text as="p" size="2" color="red" className="mt-4">
            {error}
          </Text>
        )}
      </Card>
    </div>
  );
}
