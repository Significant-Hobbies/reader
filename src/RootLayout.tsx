import { Theme } from '@radix-ui/themes';
import { Outlet } from 'react-router-dom';

import { AuthProvider } from './components/AuthProvider';
import { AnalyticsProvider } from './components/posthog-provider';
import { QueryProvider } from './components/QueryProvider';
import { SaaSMakerFeedback } from './components/saasmaker-feedback';

export default function RootLayout() {
  return (
    <Theme appearance="dark" accentColor="bronze" grayColor="sand" radius="small" scaling="95%">
      <AnalyticsProvider>
        <AuthProvider>
          <QueryProvider>
            <Outlet />
          </QueryProvider>
          <SaaSMakerFeedback />
        </AuthProvider>
      </AnalyticsProvider>
    </Theme>
  );
}
