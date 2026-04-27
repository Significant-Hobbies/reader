import { expect, test } from '@playwright/test';

test('login page renders with Google sign-in button', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText('Sign in to access your library')).toBeVisible();
  await expect(page.getByRole('button', { name: /sign in with google/i })).toBeEnabled();
});

test('unauthenticated home redirects to login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
});
