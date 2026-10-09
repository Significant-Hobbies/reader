import { expect, test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('the saved-link workflow works at every viewport', async ({ page }, testInfo) => {
  const date = '2026-10-09T00:00:00.000Z';
  const items = [
    {
      id: 'one',
      url: 'https://www.sqlite.org/whentouse.html',
      title: 'Appropriate uses for SQLite',
      status: 'unread',
      createdAt: date,
    },
    {
      id: 'two',
      url: 'https://paulgraham.com/makersschedule.html',
      title: 'Maker’s schedule, manager’s schedule',
      status: 'unread',
      createdAt: date,
    },
  ];
  await page.route('https://**', (route) => route.abort());
  await page.route('**/api/auth/get-session', (route) =>
    route.fulfill({
      json: {
        user: {
          id: 'alice',
          name: 'Alice',
          email: 'alice@example.com',
          emailVerified: true,
          image: null,
          createdAt: date,
          updatedAt: date,
        },
        session: {
          id: 'session',
          userId: 'alice',
          token: 'synthetic',
          expiresAt: '2099-01-01T00:00:00.000Z',
          createdAt: date,
          updatedAt: date,
        },
      },
    })
  );
  await page.route('**/api/links**', async (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      const body = request.postDataJSON();
      items.push({ id: 'new', ...body, status: 'unread', createdAt: date });
      return route.fulfill({ json: { id: 'new', existing: false } });
    }
    if (request.method() === 'PUT') {
      const item = items.find((entry) => request.url().endsWith(`/${entry.id}`))!;
      item.status = request.postDataJSON().status;
      return route.fulfill({ json: item });
    }
    const params = new URL(request.url()).searchParams;
    const rows = items.filter(
      (item) =>
        (!params.get('status') || item.status === params.get('status')) &&
        (!params.get('q') || item.title.includes(params.get('q')!))
    );
    return route.fulfill({ json: { items: rows, total: rows.length, nextOffset: null } });
  });
  await page.goto('/library');
  await expect(page.getByRole('heading', { name: 'Your links' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Appropriate uses for SQLite' })).toBeVisible();
  await mkdir('.fleet-local/screenshots', { recursive: true });
  await page.screenshot({
    path: `.fleet-local/screenshots/inbox-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Mark read: Appropriate uses for SQLite' }).click();
  await expect(page.getByRole('link', { name: 'Appropriate uses for SQLite' })).toHaveCount(0);
  await page.getByRole('button', { name: 'read', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Appropriate uses for SQLite' })).toBeVisible();
  await page.getByRole('button', { name: 'Mark unread: Appropriate uses for SQLite' }).click();
  await page.getByRole('button', { name: 'Add link' }).click();
  await page.getByLabel('URL', { exact: true }).fill('https://example.com/new');
  await page.getByLabel('Title').fill('A new link');
  await page.getByRole('button', { name: 'Save link', exact: true }).click();
  await expect(page.getByRole('link', { name: 'A new link' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Search links' }).fill('SQLite');
  await expect(page.getByRole('link', { name: 'Appropriate uses for SQLite' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'A new link' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
});

test('landing states the narrow product and fits the viewport', async ({ page }, testInfo) => {
  await page.route('https://**', (route) => route.abort());
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Save a link. Pick it up in ChatGPT.' })
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true
  );
  await mkdir('.fleet-local/screenshots', { recursive: true });
  await page.screenshot({
    path: `.fleet-local/screenshots/landing-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
