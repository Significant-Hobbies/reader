'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { Button } from './ui/button';

export default function LoginClient() {
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const handleSignIn = async () => {
    setError(null);
    setSigningIn(true);
    try {
      setRedirecting(true);
      await signIn('google', { callbackUrl: '/' });
    } catch (err) {
      console.error('Sign-in error:', err);
      setError('Failed to sign in. Please try again.');
      setSigningIn(false);
      setRedirecting(false);
    }
  };

  if (redirecting) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-400">Loading your library...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-gray-900 flex items-center justify-center p-8">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Web Annotator</h1>
          <p className="text-gray-400 mt-2">Sign in to access your library</p>
        </div>

        <Button onClick={handleSignIn} disabled={signingIn} className="w-full py-3 text-base">
          {signingIn ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Signing in...
            </span>
          ) : (
            'Sign in with Google'
          )}
        </Button>

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
