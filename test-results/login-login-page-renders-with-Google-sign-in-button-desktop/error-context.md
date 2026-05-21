# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login.spec.ts >> login page renders with Google sign-in button
- Location: tests/login.spec.ts:3:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Sign in to access your library')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('Sign in to access your library')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
    - generic [ref=e4]:
        - generic [ref=e5]:
            - paragraph [ref=e6]: Personal research library
            - heading "Library" [level=1] [ref=e7]
            - paragraph [ref=e8]: Sign in to organize imported articles, outside links, and research PDFs.
        - button "Sign in with Google" [ref=e9]
    - button "Open Next.js Dev Tools" [ref=e15] [cursor=pointer]:
        - img [ref=e16]
    - alert [ref=e19]
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  |
  3  | test('login page renders with Google sign-in button', async ({ page }) => {
  4  |   await page.goto('/login');
> 5  |   await expect(page.getByText('Sign in to access your library')).toBeVisible();
     |                                                                  ^ Error: expect(locator).toBeVisible() failed
  6  |   await expect(page.getByRole('button', { name: /sign in with google/i })).toBeEnabled();
  7  | });
  8  |
  9  | test('unauthenticated home redirects to login', async ({ page }) => {
  10 |   await page.goto('/');
  11 |   await expect(page).toHaveURL(/\/login/);
  12 | });
  13 |
```
