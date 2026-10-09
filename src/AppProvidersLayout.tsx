import { Outlet } from 'react-router-dom';

import { AuthProvider } from './components/AuthProvider';
import { AnalyticsProvider } from './components/posthog-provider';
import { QueryProvider } from './components/QueryProvider';

/** App shell: auth, query, analytics — not loaded on `/`. Uses app-tokens.css for theme vars. */
export default function AppProvidersLayout() {
  return (
    <AnalyticsProvider>
      <AuthProvider>
        <QueryProvider>
          <Outlet />
        </QueryProvider>
      </AuthProvider>
    </AnalyticsProvider>
  );
}
