import type { ComponentType } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

import RootLayout from './RootLayout';
import { ReaderEntry } from './components/ReaderEntry';

function lazyPage(module: () => Promise<{ default: ComponentType }>) {
  return module().then((m) => ({ Component: m.default }));
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    hydrateFallbackElement: <ReaderEntry pending />,
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
