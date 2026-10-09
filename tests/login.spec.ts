import { expect, test } from '@playwright/test';
test('sign-in is the only guest inbox action', async ({ page }) => {
  await page.route('**/api/auth/get-session', (route) => route.fulfill({ json: null }));
  await page.route('**/api/auth/client-config', (route) =>
    route.fulfill({ json: { googleClientId: null } })
  );
  await page.goto('/library');
  await expect(page).toHaveURL(/\/login$/u);
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
  await expect(page.getByText('Save links from the web.', { exact: false })).toBeVisible();
});
