import { test as base, expect } from '@playwright/test';

export const syntheticSession = {
  user: {
    id: 'alice',
    name: 'Alice',
    email: 'alice@example.com',
    emailVerified: true,
    image: null,
    createdAt: '2026-10-09T00:00:00.000Z',
    updatedAt: '2026-10-09T00:00:00.000Z',
  },
  session: {
    id: 'session',
    userId: 'alice',
    token: 'synthetic',
    expiresAt: '2099-01-01T00:00:00.000Z',
    createdAt: '2026-10-09T00:00:00.000Z',
    updatedAt: '2026-10-09T00:00:00.000Z',
  },
};

export const test = base.extend({
  context: async ({ context, baseURL }, use) => {
    const origin = new URL(baseURL!).origin;
    // Context routing covers pages/popups; only the local preview can receive traffic.
    await context.route('**/*', (route) =>
      new URL(route.request().url()).origin === origin ? route.continue() : route.abort()
    );
    await context.routeWebSocket('**/*', (socket) => socket.close());
    await use(context);
  },
});

export { expect };
