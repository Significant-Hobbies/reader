'use client';

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useState } from 'react';

function handle401() {
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (_error, query) => {
            if (query.state.fetchStatus === 'idle' && query.state.status === 'error') {
              const meta = query.state.error as { status?: number } | undefined;
              if (meta && 'status' in meta && meta.status === 401) {
                handle401();
              }
            }
          },
        }),
        mutationCache: new MutationCache({
          onError: (error) => {
            if (error && 'status' in error && (error as { status: number }).status === 401) {
              handle401();
            }
          },
        }),
        defaultOptions: {
          queries: {
            retry: (failureCount, error) => {
              if (error && 'status' in error && (error as { status: number }).status === 401) {
                return false;
              }
              return failureCount < 3;
            },
          },
        },
      })
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
