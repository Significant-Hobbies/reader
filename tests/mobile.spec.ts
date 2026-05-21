import { expect, type Page, test } from '@playwright/test';

/**
 * Mobile-viewport checks — runs under the `mobile` Playwright project
 * (iPhone 13 = 390px wide). Verifies the public surfaces render without a
 * horizontal scroll at the Wave 1 mobile target.
 *
 * The reader / annotation view itself is auth-gated, so it is exercised in
 * the unit/integration layer and manual verification; here we cover the
 * publicly reachable pages that must not break at 390px.
 *
 * Skipped on the `desktop` project — these assertions are mobile-specific.
 */

const PUBLIC_ROUTES = ['/welcome', '/login', '/about'];

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
}

test.describe('mobile viewport — 390px', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 1280) > 600, 'mobile-only checks');

  for (const path of PUBLIC_ROUTES) {
    test(`no horizontal scroll on ${path}`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(400);
      const overflow = await horizontalOverflow(page);
      expect(overflow, `${path} should not scroll horizontally`).toBeLessThanOrEqual(1);
    });
  }

  test('welcome landing shows hero and a clear CTA', async ({ page }) => {
    await page.goto('/welcome', { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('heading', {
        name: /read, annotate, and chat with everything you save/i,
      })
    ).toBeVisible();
    // The primary CTA must be a real, reachable link.
    const cta = page.getByRole('link', { name: /open your library/i }).first();
    await expect(cta).toBeVisible();
    const box = await cta.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { width: r.width, height: r.height };
    });
    expect(box.height, 'CTA touch-target height').toBeGreaterThanOrEqual(44);
  });
});
