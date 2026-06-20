'use client';

import { useEffect } from 'react';

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    void import('@/lib/foundry-monitoring').then((m) => {
      cleanup = m.installBrowserMonitoring();
    });
    return () => cleanup?.();
  }, []);

  return <>{children}</>;
}
