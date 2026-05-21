'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { captureError } from '@/lib/foundry-monitoring';

export default function ReaderError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    captureError(error, { scope: 'unknown', digest: error.digest, source: 'reader_route' });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#15130f] p-8 text-gray-100">
      <div className="max-w-md text-center">
        <h2 className="mb-3 text-xl font-bold">Couldn&apos;t open this document</h2>
        <p className="mb-6 text-sm text-gray-400">
          Something went wrong while loading this article. Your saved content is safe — try again.
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-md bg-[var(--accent-9)] px-4 py-2 text-white transition hover:bg-[var(--accent-10)]"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-md border border-[var(--gray-6)] bg-[var(--gray-3)] px-4 py-2 text-gray-200 transition hover:bg-[var(--gray-4)]"
          >
            Library
          </Link>
        </div>
        {error.digest ? (
          <p className="mt-6 text-xs text-gray-600">Reference: {error.digest}</p>
        ) : null}
      </div>
    </div>
  );
}
