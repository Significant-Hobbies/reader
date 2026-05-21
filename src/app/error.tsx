'use client';

import { useEffect } from 'react';

import { captureError } from '@/lib/foundry-monitoring';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Full detail goes to the console + PostHog — never to the user.
    console.error(error);
    captureError(error, { scope: 'root', digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h2 className="mb-3 text-2xl font-bold">Something went wrong</h2>
        <p className="mb-6 text-sm opacity-70">
          An unexpected error occurred. Your library is safe — try again, and if it keeps happening,
          come back in a few minutes.
        </p>
        <div className="flex justify-center gap-3">
          <button onClick={reset} className="rounded border px-4 py-2 hover:opacity-80">
            Try again
          </button>
          <button
            onClick={() => window.location.replace('/')}
            className="rounded border px-4 py-2 hover:opacity-80"
          >
            Home
          </button>
        </div>
        {error.digest ? <p className="mt-6 text-xs opacity-40">Reference: {error.digest}</p> : null}
      </div>
    </div>
  );
}
