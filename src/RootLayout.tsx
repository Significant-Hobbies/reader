import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

import { trackPageView } from './lib/analytics';

export default function RootLayout() {
  const location = useLocation();
  useEffect(() => {
    void location.pathname; // re-fire on route change
    trackPageView();
  }, [location.pathname]);

  return <Outlet />;
}
