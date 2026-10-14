import { act, useEffect, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  session: { data: null as null | { user: { id: string; email: string } }, isPending: true },
  social: vi.fn(),
  signOut: vi.fn(),
  oneTap: vi.fn(),
}));
vi.mock('@/lib/auth-client', () => ({
  useSession: () => mocks.session,
  signIn: { social: mocks.social },
  signOut: mocks.signOut,
  startGoogleOneTap: mocks.oneTap,
}));
vi.mock('@/lib/analytics', () => ({ trackReturnedOnce: vi.fn(), trackSignupOnce: vi.fn() }));
vi.mock('@/lib/foundry-monitoring', () => ({ captureAuthFailure: vi.fn() }));
import { AuthProvider, useAuth } from './AuthProvider';
import LoginClient from './LoginClient';
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  mocks.session = { data: null, isPending: true };
  mocks.oneTap.mockReset().mockResolvedValue(undefined);
  mocks.social.mockReset().mockResolvedValue({});
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});
async function render(child: ReactNode) {
  await act(async () => {
    root.render(<AuthProvider>{child}</AuthProvider>);
  });
}
describe('auth loading preserves its subtree', () => {
  it('retains DOM and local state through pending, signed-out and account changes', async () => {
    let mounts = 0;
    function Child() {
      const { user, loading } = useAuth();
      useEffect(() => {
        mounts += 1;
      }, []);
      return (
        <>
          <input defaultValue="draft" />
          <output>{loading ? 'pending' : (user?.id ?? 'signed-out')}</output>
        </>
      );
    }
    await render(<Child />);
    const input = host.querySelector('input')!;
    input.value = 'retained draft';
    expect(host.querySelector('output')?.textContent).toBe('pending');
    mocks.session = { data: null, isPending: false };
    await render(<Child />);
    expect(host.querySelector('output')?.textContent).toBe('signed-out');
    mocks.session = {
      data: { user: { id: 'synthetic-account', email: 'audit@example.invalid' } },
      isPending: false,
    };
    await render(<Child />);
    expect(host.querySelector('output')?.textContent).toBe('synthetic-account');
    expect(host.querySelector('input')).toBe(input);
    expect(input.value).toBe('retained draft');
    expect(mounts).toBe(1);
  });
  it('initializes Login once and shows NetworkError while keeping standard sign-in', async () => {
    mocks.oneTap.mockRejectedValue(
      new DOMException('Synthetic FedCM network failure', 'NetworkError')
    );
    await render(<LoginClient />);
    expect(mocks.oneTap).toHaveBeenCalledTimes(1);
    expect(mocks.oneTap).toHaveBeenCalledWith('/library');
    expect(host.querySelector('[role=alert]')?.textContent).toBe(
      'One-tap sign-in is unavailable. Sign in with Google to continue.'
    );
    const button = host.querySelector('button')!;
    expect(button.disabled).toBe(false);
    await act(async () => button.click());
    expect(mocks.social).toHaveBeenCalledWith({ provider: 'google', callbackURL: '/' });
  });
});
