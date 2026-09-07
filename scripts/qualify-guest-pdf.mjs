import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { syntheticPdf, serveBuiltReader } from './pdf-browser-fixture.mjs';

test('guest imports, reads, annotates, reopens, edits and deletes a real local PDF', {
  timeout: 120000,
}, async () => {
  const { server, origin } = await serveBuiltReader();
  const browser = await chromium.launch();
  const writes = [];
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/*', (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname.startsWith('/api/')) {
        if (!['GET', 'HEAD'].includes(request.method())) writes.push(url.pathname);
        return route.fulfill({
          status: url.pathname.includes('/auth/') ? 200 : 401,
          contentType: 'application/json',
          body: 'null',
        });
      }
      return route.continue();
    });
    await page.goto(`${origin}/library`);

    await page
      .getByRole('button', { name: /Research PDF/ })
      .first()
      .click();
    await page.locator('input[type=file]').setInputFiles({
      name: 'Synthetic research.pdf',
      mimeType: 'application/pdf',
      buffer: syntheticPdf(),
    });
    await page.getByRole('button', { name: 'Import PDF', exact: true }).last().click();
    await page.getByText('Synthetic research', { exact: true }).first().click();
    await expect(
      page.getByRole('heading', { name: 'Synthetic research', exact: true })
    ).toBeVisible();
    const evidence = '.fleet/evidence/guest-pdf';
    await mkdir(evidence, { recursive: true });
    await annotateAndReopen(page, origin, evidence);
    assert.deepEqual(writes, [], 'Guest PDF and notes must never be uploaded');
    assert.deepEqual(errors, []);
    console.log(
      'PASS: built UI imported and rendered two real PDF pages; page-2 note survived reload, navigated to its anchor, edited, reopened and deleted. No API writes; 390/768/1440 overflow checks passed.'
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

async function annotateAndReopen(page, origin, evidence) {
  await expect(page.getByText('Synthetic research page one', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page two: keep the evidence', { exact: true })).toBeVisible();
  await page
    .getByLabel('Page note', { exact: true })
    .fill('The second page supports the conclusion.');
  await page.evaluate(() => {
    window.originalOpen = IDBFactory.prototype.open;
    IDBFactory.prototype.open = () => {
      throw new Error('Synthetic storage failure');
    };
  });
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Could not save this change');
  await expect(page.getByLabel('Page note', { exact: true })).toHaveValue(
    'The second page supports the conclusion.'
  );
  await page.evaluate(() => {
    IDBFactory.prototype.open = window.originalOpen;
  });
  await page.getByRole('button', { name: 'Save note', exact: true }).click();
  await expect(page.getByText('Saved in this browser.', { exact: true })).toBeVisible();
  const url = page.url();
  await page.reload();
  await expect(
    page.getByText('The second page supports the conclusion.', { exact: true })
  ).toBeVisible();
  await page.getByRole('button', { name: 'Go to page 2', exact: true }).click();
  await expect(page.getByText('Page two: keep the evidence', { exact: true })).toBeVisible();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Previous', exact: true })).toHaveCSS(
      'opacity',
      '1'
    );
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toHaveCSS(
      'opacity',
      '0.5'
    );
    await page.screenshot({
      path: `${evidence}/after-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      `overflow at ${width}`
    ).toBe(false);
  }
  await page.getByRole('button', { name: 'Edit note', exact: true }).click();
  await page.getByLabel('Page note', { exact: true }).fill('Revised evidence note.');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.getByText('Saved in this browser.', { exact: true })).toBeVisible();
  await expect(page.getByText('Revised evidence note.', { exact: true })).toBeVisible();
  await page.goto(`${origin}/library`);
  await page.goto(url);
  await expect(page.getByText('Revised evidence note.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Delete note', exact: true }).click();
  await expect(page.getByText('No page notes yet.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('No page notes yet.', { exact: true })).toBeVisible();
}
