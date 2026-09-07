import { test } from 'node:test';
import { mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import { syntheticPdf, serveBuiltReader } from './pdf-browser-fixture.mjs';

test('account PDF exposes only supported reading controls', { timeout: 60000 }, async () => {
  const { server, origin } = await serveBuiltReader();
  const browser = await chromium.launch();
  const writes = [];
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 1000 } });
    page.on('pageerror', (error) => errors.push(error.message));
    const article = {
      id: 'synthetic-pdf',
      userId: 'synthetic-account',
      title: 'Synthetic account PDF',
      type: 'pdf',
      content: '',
      notes: [],
      aiChat: [],
      pdfUrl: `data:application/pdf;base64,${syntheticPdf().toString('base64')}`,
    };
    await page.route('**/*', (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== origin) return route.abort();
      if (!url.pathname.startsWith('/api/')) return route.continue();
      if (!['GET', 'HEAD'].includes(request.method())) {
        writes.push(url.pathname);
        return route.fulfill({ status: 503, body: '{}' });
      }
      const body =
        url.pathname === '/api/auth/get-session'
          ? {
              session: {
                id: 'synthetic-session',
                userId: 'synthetic-account',
                expiresAt: '2099-01-01T00:00:00Z',
              },
              user: {
                id: 'synthetic-account',
                name: 'Synthetic reader',
                email: 'reader@example.invalid',
                emailVerified: true,
              },
            }
          : url.pathname === '/api/articles/synthetic-pdf'
            ? article
            : {};
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto(`${origin}/reader/synthetic-pdf`);
    await expect(page.getByRole('heading', { name: article.title, exact: true })).toBeVisible();
    await expect(page.getByText('Synthetic research page one', { exact: true })).toBeVisible();
    await mkdir('.fleet/evidence/account-pdf', { recursive: true });
    await verifyAccountControls(page);
    expect(writes).toEqual([]);
    expect(errors).toEqual([]);
    console.log(
      'PASS: synthetic account PDF rendered; page and zoom controls work; background changes; no inert notes/font controls, provider calls or writes.'
    );
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
});

async function verifyAccountControls(page) {
  await expect(page.getByRole('button', { name: 'Notes', exact: true })).toHaveCount(0);
  await expect(
    page.getByText(
      'Page notes are available for browser-local PDFs. Account PDF notes are not available yet.',
      { exact: true }
    )
  ).toBeVisible();
  await page.getByRole('button', { name: 'Viewer background', exact: true }).click();
  await expect(page.getByRole('slider')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Serif', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sepia', exact: true }).click();
  await expect(page.locator('[data-pdf-theme="sepia"]')).toHaveCSS(
    'background-color',
    'rgb(244, 236, 216)'
  );
  await page.getByRole('button', { name: 'Viewer background', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText('Page two: keep the evidence', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reset zoom', exact: true })).toHaveText('120%');
  await page.evaluate(() => {
    speechSynthesis.speak = (utterance) => {
      window.spokenText = utterance.text;
    };
  });
  await page.getByRole('button', { name: 'Listen', exact: true }).click();
  expect(await page.evaluate(() => window.spokenText)).toContain('Page two: keep the evidence');
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open AI chat', exact: true })).toBeEnabled();
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
    await page.screenshot({
      path: `.fleet/evidence/account-pdf/after-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false
    );
  }
}
