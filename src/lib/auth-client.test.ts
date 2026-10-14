import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ oneTap: vi.fn(), vanilla: vi.fn() }));
vi.mock('better-auth/react', () => ({
  createAuthClient: () => ({ useSession: vi.fn(), signIn: {}, signOut: vi.fn() }),
}));
vi.mock('better-auth/client', () => ({ createAuthClient: mocks.vanilla }));
vi.mock('better-auth/client/plugins', () => ({ oneTapClient: vi.fn() }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.clearAllMocks();
});
describe('concurrent One Tap initialization', () => {
  it('shares initialization, propagates failure, then permits retry', async () => {
    let reject!: (error: Error) => void;
    mocks.oneTap.mockImplementationOnce(
      () =>
        new Promise<void>((_, fail) => {
          reject = fail;
        })
    );
    mocks.oneTap.mockResolvedValue(undefined);
    mocks.vanilla.mockReturnValue({ oneTap: mocks.oneTap });
    const fetch = vi
      .fn()
      .mockImplementation(
        async () => new Response(JSON.stringify({ googleClientId: 'synthetic-only' }))
      );
    vi.stubGlobal('fetch', fetch);
    const { startGoogleOneTap } = await import('./auth-client');
    const first = startGoogleOneTap('/library');
    const second = startGoogleOneTap('/library');
    expect(second).toBe(first);
    const results = Promise.allSettled([first, second]);
    await vi.waitFor(() => expect(mocks.oneTap).toHaveBeenCalledTimes(1));
    const error = new DOMException('Synthetic network failure', 'NetworkError');
    reject(error);
    expect(await results).toEqual([
      { status: 'rejected', reason: error },
      { status: 'rejected', reason: error },
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
    await startGoogleOneTap('/library');
    expect(mocks.oneTap).toHaveBeenCalledTimes(2);
  });
  it('uses null config without invoking a provider', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ googleClientId: null })))
    );
    const { startGoogleOneTap } = await import('./auth-client');
    await startGoogleOneTap('/library');
    expect(mocks.vanilla).not.toHaveBeenCalled();
  });
});
