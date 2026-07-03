'use client';

import { useEffect } from 'react';

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    void import('@/lib/foundry-monitoring').then((m) => {
      cleanup = m.installBrowserMonitoring();
    });
    void import('@/lib/api-timing').then((m) => m.initApiTiming()).catch(() => {});
    return () => cleanup?.();
  }, []);

  return <>{children}</>;
}
