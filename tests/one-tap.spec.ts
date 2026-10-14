import { expect, test } from './fixtures';

test('one synthetic initialization across auth loading; errors retain standard sign-in', async ({
  page,
}) => {
  test.setTimeout(60000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: 1_600_000 / 8,
    uploadThroughput: 750_000 / 8,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  let configRequests = 0;
  await page.addInitScript(() => {
    Object.assign(window, {
      googleScriptInitialized: true,
      syntheticOneTapInitializations: 0,
      google: {
        accounts: {
          id: {
            initialize: () => {
              const state = window as unknown as { syntheticOneTapInitializations: number };
              state.syntheticOneTapInitializations += 1;
              throw new DOMException('Synthetic FedCM network failure', 'NetworkError');
            },
          },
        },
      },
    });
  });
  await page.route('**/api/auth/get-session', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await route.fulfill({ json: null });
  });
  await page.route('**/api/auth/client-config', (route) => {
    configRequests += 1;
    return route.fulfill({ json: { googleClientId: 'synthetic-local-only' } });
  });
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  const sessionResponse = page.waitForResponse((response) =>
    response.url().includes('/api/auth/get-session')
  );
  await page.goto('/login');
  await expect(page.getByRole('alert')).toHaveText('NetworkError: Synthetic FedCM network failure');
  await sessionResponse;
  expect(configRequests).toBe(1);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { syntheticOneTapInitializations: number })
          .syntheticOneTapInitializations
    )
  ).toBe(1);
  expect(
    consoleErrors.some((message) => message.includes('Error during Google One Tap flow'))
  ).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('one-tap-error.png'), fullPage: true });
  await page.route('**/api/auth/sign-in/social', async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ provider: 'google', callbackURL: '/' });
    await route.fulfill({
      status: 503,
      json: { message: 'Synthetic standard sign-in unavailable' },
    });
  });
  await page.getByRole('button', { name: 'Sign in with Google', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Failed to sign in. Please try again.');
  await expect(
    page.getByRole('button', { name: 'Sign in with Google', exact: true })
  ).toBeEnabled();
});
