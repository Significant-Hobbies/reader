import { expect, syntheticSession, test } from './fixtures';

test('pending inbox reserves link rows until the saved links arrive', async ({
  page,
}, testInfo) => {
  const width = { mobile: 390, tablet: 768, desktop: 1440 }[testInfo.project.name] ?? 1440;
  await page.setViewportSize({ width, height: 900 });
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/auth/get-session', (route) => route.fulfill({ json: syntheticSession }));
  await page.route('**/api/links**', async (route) => {
    await pending;
    await route.fulfill({
      json: {
        items: Array.from({ length: 5 }, (_, index) => ({
          id: String(index),
          url: `https://example.com/link-${index}`,
          title: `Saved link ${index}`,
          status: 'unread',
          createdAt: '2026-10-22T00:00:00Z',
        })),
        total: 5,
        nextOffset: null,
      },
    });
  });
  await page.goto('/library');
  const loading = page.getByRole('status', { name: 'Loading links', exact: true });
  await expect(loading).toBeVisible();
  const rows = loading.locator('li');
  await expect(rows).toHaveCount(5);
  const before = await rows.first().boundingBox();
  expect(before?.height).toBeGreaterThanOrEqual(80);
  await page.screenshot({ path: testInfo.outputPath('pending.png') });
  await expect(page.getByText('Nothing unread', { exact: true })).toHaveCount(0);
  release();
  await expect(page.getByText('Saved link 0', { exact: true })).toBeVisible();
  await expect(loading).toHaveCount(0);
  const after = await page.locator('main li').first().boundingBox();
  expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(after!.height - before!.height)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('ready.png') });
});
