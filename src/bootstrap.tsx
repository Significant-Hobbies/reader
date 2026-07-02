import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import '@/styles/globals.css';
import { ErrorBoundary } from './components/ErrorBoundary';

async function mount() {
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    throw new Error('Root element #root not found');
  }

  const { router } = await import('./router');

  const app = (
    <StrictMode>
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </StrictMode>
  );

  const shellType = document.documentElement.dataset.staticShell;
  const useHydrate = shellType === 'library-empty' || shellType === 'library-grid';

  if (useHydrate) {
    hydrateRoot(rootEl, app);
  } else {
    createRoot(rootEl).render(app);
  }
}

void mount();
