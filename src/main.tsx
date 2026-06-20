import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import '@/styles/globals.css';
import { router } from './router';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found');
}

const app = (
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);

const hasStaticShell = rootEl.querySelector('.spa-static-shell');
if (hasStaticShell) {
  hydrateRoot(rootEl, app);
} else {
  createRoot(rootEl).render(app);
}
