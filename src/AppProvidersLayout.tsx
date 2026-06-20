import { lazy, Suspense } from 'react';
import { Outlet } from 'react-router-dom';

import { AuthProvider } from './components/AuthProvider';
import { AnalyticsProvider } from './components/posthog-provider';
import { QueryProvider } from './components/QueryProvider';

const SaaSMakerFeedback = lazy(() =>
  import('./components/saasmaker-feedback').then((m) => ({ default: m.SaaSMakerFeedback }))
);

/** App shell: auth, query, analytics — not loaded on `/`. Uses app-tokens.css for theme vars. */
export default function AppProvidersLayout() {
  return (
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
  );
}
