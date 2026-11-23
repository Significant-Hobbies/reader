import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import '@/styles/globals.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { router } from './router';

function mount() {
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    throw new Error('Root element #root not found');
  }

  const app = (
    <StrictMode>
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </StrictMode>
  );

  createRoot(rootEl).render(app);
}

mount();
