import type { Page } from '@playwright/test';
import { expect, syntheticSession, test } from './fixtures';

async function publicAuth(page: Page) {
  await page.route('**/api/auth/get-session', (route) => route.fulfill({ json: null }));
  await page.route('**/api/auth/client-config', (route) =>
    route.fulfill({ json: { googleClientId: null } })
  );
}

function privateRequests(page: Page) {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (/\/api\/(links|keys)(?:[/?]|$)/u.test(request.url())) requests.push(request.url());
  });
  return requests;
}

async function render(page: Page, name: string) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await page.screenshot({ path: test.info().outputPath(`${name}.png`), fullPage: true });
}

test('guest inbox stays at a clear entry until explicit sign-in', async ({ page }) => {
  await publicAuth(page);
  const requests = privateRequests(page);
  await page.goto('/library');
  await expect(page.getByRole('link', { name: 'Sign in to your inbox' })).toBeVisible();
  await expect(page).toHaveURL(/\/library$/u);
  await expect(page.getByRole('heading', { name: 'Reader', exact: true })).toBeVisible();
  await expect(page.getByText('Checking your session…')).toHaveCount(0);
  await expect(page.getByText('Loading Reader…')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Add link' })).toHaveCount(0);
  await render(page, 'guest-entry');
  await page.getByRole('link', { name: 'Sign in to your inbox' }).click();
  await expect(page).toHaveURL(/\/login$/u);
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
  await render(page, 'login');
  expect(requests).toEqual([]);
});

for (const signedIn of [false, true]) {
  test(`pending auth waits before resolving ${signedIn ? 'the inbox' : 'the guest entry'}`, async ({
    page,
  }) => {
    const requests = privateRequests(page);
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/auth/get-session', async (route) => {
      await ready;
      await route.fulfill({ json: signedIn ? syntheticSession : null });
    });
    await page.route('**/api/links**', (route) =>
      route.fulfill({ json: { items: [], total: 0, nextOffset: null } })
    );
    await page.goto('/library');
    await expect(page.getByRole('status')).toHaveText('Checking your session…');
    await expect(page.getByRole('heading', { name: 'Reader', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in to your inbox' })).toHaveCount(0);
    expect(requests).toEqual([]);
    await expect(page).toHaveURL(/\/library$/u);
    await render(page, 'pending-entry');
    release();
    if (signedIn) {
      await expect(page.getByRole('heading', { name: 'Your links' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Nothing unread' })).toBeVisible();
      expect(requests.length).toBeGreaterThan(0);
    } else {
      await expect(page.getByRole('link', { name: 'Sign in to your inbox' })).toBeVisible();
      expect(requests).toEqual([]);
    }
    await expect(page).toHaveURL(/\/library$/u);
  });
}

test('extension install and connection guidance is public; keys stay protected', async ({
  page,
}) => {
  await publicAuth(page);
  const requests = privateRequests(page);
  await page.goto('/extension');
  await expect(page.getByRole('heading', { name: 'Install the Chrome extension' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Reader extension release' })).toHaveAttribute(
    'href',
    'https://github.com/Significant-Hobbies/reader/releases/tag/chrome-extension-v0.2.0'
  );
  await expect(page.getByText(/chrome:\/\/extensions/u)).toBeVisible();
  await expect(page.getByText(/paste it into the extension popup/u)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sign in first' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create extension key' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Existing extension keys' })).toHaveCount(0);
  await render(page, 'guest-extension');
  expect(requests).toEqual([]);
});

test('explicit sign-in retains each page callback and shows recoverable errors', async ({
  page,
}) => {
  await publicAuth(page);
  const callbacks: string[] = [];
  await page.route('**/api/auth/sign-in/social', (route) => {
    const body = route.request().postDataJSON();
    expect(body.provider).toBe('google');
    callbacks.push(body.callbackURL);
    return route.fulfill({ status: 400, json: { message: 'Synthetic sign-in failure' } });
  });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign in with Google' }).click();
  await expect(page.getByText('Failed to sign in. Please try again.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeEnabled();
  await page.goto('/extension');
  await page.getByRole('button', { name: 'Sign in with Google' }).click();
  await expect.poll(() => callbacks).toEqual(['/', '/extension']);
});

test('signed-in connections retain key management without creating a key on entry', async ({
  page,
}) => {
  await page.route('**/api/auth/get-session', (route) => route.fulfill({ json: syntheticSession }));
  const methods: string[] = [];
  await page.route('**/api/keys', (route) => {
    methods.push(route.request().method());
    return route.fulfill({ json: [] });
  });
  await page.goto('/extension');
  await expect(page.getByRole('button', { name: 'Create extension key' })).toBeVisible();
  await expect(page.getByText('No active extension keys.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sign in first' })).toHaveCount(0);
  expect(methods).toEqual(['GET']);
});
