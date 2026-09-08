import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { serveBuiltReader } from './pdf-browser-fixture.mjs';

test('guest import preserves its draft through sign-in without an unauthorized request', {
  timeout: 60000,
}, async () => {
  const { server, origin } = await serveBuiltReader();
  const browser = await chromium.launch();
  let signedIn = false;
  const snapshots = [];
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      let body = [];
      let status = 200;
      if (url.pathname === '/api/auth/get-session') {
        body = signedIn
          ? { session: { id: 'synthetic' }, user: { id: 'synthetic', name: 'Test reader' } }
          : null;
      } else if (url.pathname.startsWith('/api/auth/')) {
        body = {};
      } else if (url.pathname === '/api/snapshot') {
        snapshots.push(url.searchParams.get('url'));
        status = 503;
        body = { error: 'Synthetic extraction unavailable' };
      }
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto(`${origin}/library`);
    await page.getByRole('button', { name: /Readable article/ }).click();
    await page.getByLabel('Article URL', { exact: true }).fill('https://example.com/research');
    await page.getByLabel('Category (optional)').fill('Research');
    await expect(page.getByText(/Your URL will be kept for you/)).toBeVisible();
    const evidence = '.fleet/evidence/import-signin';
    await mkdir(evidence, { recursive: true });
    await page.screenshot({ path: `${evidence}/guest-390.png`, animations: 'disabled' });
    await page.evaluate(() => {
      window.originalStorageSet = Storage.prototype.setItem;
      Storage.prototype.setItem = () => {
        throw new Error('Synthetic storage failure');
      };
    });
    await page.getByRole('button', { name: 'Sign in to import', exact: true }).click();
    await expect(page.getByText(/Could not keep your URL for sign-in/)).toBeVisible();
    await expect(page).toHaveURL(`${origin}/library`);
    await expect(page.getByLabel('Article URL', { exact: true })).toHaveValue(
      'https://example.com/research'
    );
    await page.evaluate(() => {
      Storage.prototype.setItem = window.originalStorageSet;
    });
    await page.getByRole('button', { name: 'Sign in to import', exact: true }).click();
    await expect(page).toHaveURL(`${origin}/login`);
    assert.deepEqual(snapshots, [], 'Guests must not call the protected snapshot endpoint');

    // Simulate the completed provider callback; no real Google login is claimed.
    signedIn = true;
    await page.goto(`${origin}/library`);
    await expect(page.getByLabel('Article URL', { exact: true })).toHaveValue(
      'https://example.com/research'
    );
    await expect(page.getByLabel('Category (optional)')).toHaveValue('Research');
    await expect(page.getByRole('button', { name: 'Import to Reader', exact: true })).toBeEnabled();
    await page.screenshot({ path: `${evidence}/restored-390.png`, animations: 'disabled' });
    assert.deepEqual(snapshots, [], 'Restoring the draft must not import automatically');
    await page.getByRole('button', { name: 'Import to Reader', exact: true }).click();
    await expect(page.getByText('Synthetic extraction unavailable')).toBeVisible();
    assert.deepEqual(snapshots, ['https://example.com/research']);
    await page.reload();
    await expect(page.getByLabel('Article URL', { exact: true })).toHaveValue(
      'https://example.com/research'
    );
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.reload();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});
