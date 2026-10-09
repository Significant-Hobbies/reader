import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

import RootLayout from './RootLayout';

function lazyPage(module: () => Promise<{ default: ComponentType }>) {
  return module().then((m) => ({ Component: m.default }));
}

function RouteLoading() {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-black px-5 text-gray-100"
      aria-busy="true"
    >
      <p role="status" className="text-sm text-gray-400">
        Loading Reader…
      </p>
    </main>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    hydrateFallbackElement: <RouteLoading />,
    children: [
      { path: 'app', element: <Navigate to="/library" replace /> },
      { path: 'privacy', lazy: () => lazyPage(() => import('./pages/PrivacyPage')) },
      {
        lazy: () => lazyPage(() => import('./AppProvidersLayout')),
        children: [
          { path: 'library', lazy: () => lazyPage(() => import('./pages/LibraryPage')) },
          { path: 'login', lazy: () => lazyPage(() => import('./pages/LoginPage')) },
          { path: 'extension', lazy: () => lazyPage(() => import('./pages/ExtensionPage')) },
        ],
      },
      { path: '*', lazy: () => lazyPage(() => import('./pages/NotFoundPage')) },
    ],
  },
]);
