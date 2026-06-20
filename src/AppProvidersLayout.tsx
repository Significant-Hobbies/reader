import '@/styles/radix-shell.css';

import { Theme } from '@radix-ui/themes';
import { lazy, Suspense } from 'react';
import { Outlet } from 'react-router-dom';

import { AuthProvider } from './components/AuthProvider';
import { AnalyticsProvider } from './components/posthog-provider';
import { QueryProvider } from './components/QueryProvider';

const SaaSMakerFeedback = lazy(() =>
  import('./components/saasmaker-feedback').then((m) => ({ default: m.SaaSMakerFeedback }))
);

/** App shell: Radix theme, auth, query, analytics — not loaded on `/`. */
export default function AppProvidersLayout() {
  return (
    <Theme appearance="dark" accentColor="bronze" grayColor="sand" radius="small" scaling="95%">
      <AnalyticsProvider>
        <AuthProvider>
          <QueryProvider>
            <Outlet />
          </QueryProvider>
          <Suspense fallback={null}>
            <SaaSMakerFeedback />
          </Suspense>
        </AuthProvider>
      </AnalyticsProvider>
    </Theme>
  );
}
