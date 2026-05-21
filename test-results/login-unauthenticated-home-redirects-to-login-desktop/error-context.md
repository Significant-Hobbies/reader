# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login.spec.ts >> unauthenticated home redirects to login
- Location: tests/login.spec.ts:9:1

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/login/
Received string:  "http://127.0.0.1:3000/"
Timeout: 5000ms

Call log:
  - Expect "toHaveURL" with timeout 5000ms
    9 × unexpected value "http://127.0.0.1:3000/"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
    - generic [ref=e3]:
        - navigation [ref=e4]:
            - generic [ref=e5]:
                - link "L Library Reader" [ref=e6] [cursor=pointer]:
                    - /url: /
                    - generic [ref=e7]: L
                    - generic [ref=e8]:
                        - paragraph [ref=e9]: Library
                        - paragraph [ref=e10]: Reader
                - generic [ref=e13]:
                    - img [ref=e14]
                    - textbox "Find saved sources..." [ref=e17]
                - link "Sign in" [ref=e18] [cursor=pointer]:
                    - /url: /login
        - generic [ref=e19]:
            - complementary [ref=e20]:
                - generic [ref=e21]:
                    - heading "Navigate" [level=3] [ref=e22]
                    - link "Library" [ref=e23] [cursor=pointer]:
                        - /url: /
                        - img [ref=e24]
                        - text: Library
                    - link "Boards" [ref=e27] [cursor=pointer]:
                        - /url: /board
                        - img [ref=e28]
                        - text: Boards
                - generic [ref=e34]:
                    - heading "Library" [level=3] [ref=e35]
                    - button "New" [ref=e36]:
                        - img [ref=e37]
                        - text: New
                - button "All Items" [ref=e38]:
                    - img [ref=e39]
                    - text: All Items
                - button "Favourites" [ref=e42]:
                    - img [ref=e43]
                    - text: Favourites
                - button "Read Later" [ref=e45]:
                    - img [ref=e46]
                    - text: Read Later
            - generic [ref=e50]:
                - banner [ref=e51]:
                    - generic [ref=e52]:
                        - heading "Library" [level=1] [ref=e53]
                        - paragraph [ref=e54]: Save links, import articles, and read PDFs in one place.
                        - generic [ref=e55]: Local only on this browser
                    - button "Add Source" [ref=e56]:
                        - img [ref=e57]
                        - text: Add Source
                - group [ref=e59]:
                    - radio "All0" [checked] [ref=e60]:
                        - generic [ref=e62]:
                            - generic [ref=e63]: All0
                            - generic [ref=e64]: All0
                    - radio "Imported0" [ref=e65]:
                        - generic [ref=e67]:
                            - generic [ref=e68]: Imported0
                            - generic [ref=e69]: Imported0
                    - radio "Links0" [ref=e70]:
                        - generic [ref=e72]:
                            - generic [ref=e73]: Links0
                            - generic [ref=e74]: Links0
                    - radio "PDFs0" [ref=e75]:
                        - generic [ref=e77]:
                            - generic [ref=e78]: PDFs0
                            - generic [ref=e79]: PDFs0
                - generic [ref=e82]:
                    - img [ref=e84]
                    - paragraph [ref=e86]: Start your library
                    - heading "Add your first source" [level=2] [ref=e87]
                    - paragraph [ref=e88]: Save an outside link, import a readable article, or keep a research PDF in this browser.
                    - button "Add Source" [ref=e89]:
                        - img [ref=e90]
                        - text: Add Source
                    - link "New here? See what Web Annotator does" [ref=e91] [cursor=pointer]:
                        - /url: /welcome
    - button "Open Next.js Dev Tools" [ref=e97] [cursor=pointer]:
        - img [ref=e98]
    - alert [ref=e101]
```

# Test source

```ts
  1  | import { expect, test } from '@playwright/test';
  2  |
  3  | test('login page renders with Google sign-in button', async ({ page }) => {
  4  |   await page.goto('/login');
  5  |   await expect(page.getByText('Sign in to access your library')).toBeVisible();
  6  |   await expect(page.getByRole('button', { name: /sign in with google/i })).toBeEnabled();
  7  | });
  8  |
  9  | test('unauthenticated home redirects to login', async ({ page }) => {
  10 |   await page.goto('/');
> 11 |   await expect(page).toHaveURL(/\/login/);
     |                      ^ Error: expect(page).toHaveURL(expected) failed
  12 | });
  13 |
```
