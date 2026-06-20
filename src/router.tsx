import type { ComponentType } from 'react';
import { createBrowserRouter } from 'react-router-dom';

import RootLayout from './RootLayout';
import LandingPage from './pages/LandingPage';

function lazyPage(module: () => Promise<{ default: ComponentType }>) {
  return module().then((m) => ({ Component: m.default }));
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'about', lazy: () => lazyPage(() => import('./pages/AboutPage')) },
      { path: 'privacy', lazy: () => lazyPage(() => import('./pages/PrivacyPage')) },
      {
        lazy: () => lazyPage(() => import('./AppProvidersLayout')),
        children: [
          { path: 'library', lazy: () => lazyPage(() => import('./pages/LibraryPage')) },
          { path: 'login', lazy: () => lazyPage(() => import('./pages/LoginPage')) },
          { path: 'reader/:id', lazy: () => lazyPage(() => import('./pages/ReaderPage')) },
          { path: 'board', lazy: () => lazyPage(() => import('./pages/BoardListPage')) },
          { path: 'board/:id', lazy: () => lazyPage(() => import('./pages/BoardPage')) },
          { path: 'share/:shareId', lazy: () => lazyPage(() => import('./pages/SharedBoardPage')) },
          {
            path: 'share/article/:shareId',
            lazy: () => lazyPage(() => import('./pages/SharedArticlePage')),
          },
          { path: 'welcome', lazy: () => lazyPage(() => import('./pages/WelcomePage')) },
          { path: 'sample', lazy: () => lazyPage(() => import('./pages/SamplePage')) },
          { path: 'memory', lazy: () => lazyPage(() => import('./pages/MemoryPage')) },
          { path: 'extension', lazy: () => lazyPage(() => import('./pages/ExtensionPage')) },
        ],
      },
      { path: '*', lazy: () => lazyPage(() => import('./pages/NotFoundPage')) },
    ],
  },
]);
