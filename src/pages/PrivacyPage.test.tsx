import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import PrivacyPage from './PrivacyPage';
import copy from '../public-copy.json';

it('restores the app title when leaving a server-titled privacy page', async () => {
  const previous = document.title;
  document.title = copy.privacy.title;
  const element = document.createElement('div');
  const root = createRoot(element);
  try {
    await act(async () =>
      root.render(
        <MemoryRouter>
          <PrivacyPage />
        </MemoryRouter>
      )
    );
    expect(document.title).toBe(copy.privacy.title);
    await act(async () => root.unmount());
    expect(document.title).toBe('Reader — your saved-link inbox');
  } finally {
    document.title = previous;
  }
});
