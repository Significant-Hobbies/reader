import { mkdirSync } from 'node:fs';
import type { Hono } from 'hono';
import { chromium, expect as browserExpect } from '@playwright/test';
import { expect, test, vi } from 'vitest';
import { accountFixture } from './account-handler-fixture';
import { serveBuiltReader, syntheticPdf } from './pdf-browser-fixture.mjs';

// Authentication is the only mocked application boundary. Article ownership,
// validation, Drizzle queries and SQLite persistence run unchanged.
vi.mock('../src/lib/auth-api', () => ({
  getAuthenticatedUserId: async (headers: Headers) =>
    headers.get('cookie')?.match(/fixture-user=(alice|bob)/)?.[1] ?? null,
}));

function request(app: Hono, user: string, id: string, notes?: unknown[]) {
  return app.request(`/api/articles/${id}`, {
    method: notes ? 'PUT' : 'GET',
    headers: { cookie: `fixture-user=${user}`, 'content-type': 'application/json' },
    ...(notes ? { body: JSON.stringify({ notes }) } : {}),
  });
}

test('real account handlers persist page anchors and reject foreign reads and writes', async () => {
  const { sqlite, app } = accountFixture();
  try {
    const notes = [
      { id: 1, text: '<b>Page evidence</b>', anchor: { elementIndex: 1, pageNumber: 2 } },
    ];
    expect((await request(app, 'alice', 'alice-pdf', notes)).status).toBe(200);
    let article = await (await request(app, 'alice', 'alice-pdf')).json();
    expect(article.notes).toEqual([
      { id: 1, text: 'Page evidence', anchor: { elementIndex: 1, pageNumber: 2 } },
    ]);
    expect(article.notesCount).toBe(1);
    for (const user of ['bob', 'guest']) {
      for (const payload of [undefined, []]) {
        expect((await request(app, user, 'alice-pdf', payload)).status).toBe(
          user === 'bob' ? 404 : 401
        );
      }
    }
    for (const pageNumber of [0, -1, 1.5, '2', Number.MAX_SAFE_INTEGER + 1]) {
      await request(app, 'alice', 'alice-pdf', [
        { id: 1, text: 'Invalid anchor', anchor: { elementIndex: 1, pageNumber } },
      ]);
      article = await (await request(app, 'alice', 'alice-pdf')).json();
      expect(article.notes[0].anchor).toEqual({ elementIndex: 1 });
    }
    expect((await request(app, 'alice', 'alice-pdf', [])).status).toBe(200);
    expect((await (await request(app, 'alice', 'alice-pdf')).json()).notesCount).toBe(0);
    expect((await (await request(app, 'bob', 'bob-pdf')).json()).notes).toEqual([]);
  } finally {
    sqlite.close();
  }
});

test('built account PDF creates, edits, deletes and reopens real persisted notes for two isolated accounts', async () => {
  const { sqlite, app } = accountFixture();
  let failNextSave = false;
  let holdMethod: string | null = null;
  let releaseResponse: (() => void) | undefined;
  const writes: string[] = [];
  const session = (user: string) => ({
    session: { id: `${user}-session`, userId: user, expiresAt: '2099-01-01T00:00:00Z' },
    user: { id: user, name: user, email: `${user}@example.invalid`, emailVerified: true },
  });
  const { server, origin } = await serveBuiltReader(async (req: Request) => {
    const url = new URL(req.url);
    const user = req.headers.get('cookie')?.match(/fixture-user=(alice|bob)/)?.[1];
    if (url.pathname === '/api/auth/get-session') return Response.json(user ? session(user) : null);
    if (url.pathname.startsWith('/api/pdfs/')) {
      const id = url.pathname.split('/')[3];
      const owned = await request(app, user ?? 'guest', id);
      return owned.ok
        ? new Response(syntheticPdf(), { headers: { 'content-type': 'application/pdf' } })
        : new Response(null, { status: owned.status });
    }
    if (req.method === 'PUT') {
      writes.push(`${user}:${url.pathname}`);
      if (failNextSave) {
        failNextSave = false;
        return Response.json({ error: 'Synthetic unavailable' }, { status: 503 });
      }
    }
    if (url.pathname.startsWith('/api/articles/')) {
      // Capture the authenticated response before delaying its delivery.
      const result = await app.fetch(req);
      if (holdMethod === req.method) {
        holdMethod = null;
        await new Promise<void>((resolve) => {
          releaseResponse = resolve;
        });
      }
      return result;
    }
    return Response.json({});
  });
  const browser = await chromium.launch();
  const errors: string[] = [];
  const external: string[] = [];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 1000 } });
    await context.addCookies([{ name: 'fixture-user', value: 'alice', url: origin }]);
    await context.route('**/*', (route) => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      external.push(new URL(route.request().url()).hostname);
      return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${origin}/reader/alice-pdf`);
    await browserExpect(
      page.getByText('Synthetic research page one', { exact: true })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await browserExpect(
      page.getByText('Page two: keep the evidence', { exact: true })
    ).toBeVisible();
    await page
      .getByRole('textbox', { name: 'Page note', exact: true })
      .fill('Alice page two evidence');
    failNextSave = true;
    await page.getByRole('button', { name: 'Save note', exact: true }).click();
    await browserExpect(page.getByRole('alert')).toContainText('Your draft is still here');
    await browserExpect(page.getByRole('textbox', { name: 'Page note', exact: true })).toHaveValue(
      'Alice page two evidence'
    );
    expect(
      JSON.parse(
        String(sqlite.prepare("SELECT notes FROM articles WHERE id = 'alice-pdf'").get()?.notes)
      )
    ).toEqual([]);
    await page.getByRole('button', { name: 'Save note', exact: true }).click();
    await browserExpect(page.getByRole('status')).toContainText('Saved to your account.');
    await page.reload();
    await browserExpect(page.getByText('Alice page two evidence', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Go to page 2', exact: true }).click();
    await browserExpect(
      page.getByText('Page two: keep the evidence', { exact: true })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Edit note', exact: true }).click();
    await page
      .getByRole('textbox', { name: 'Page note', exact: true })
      .fill('Alice revised evidence');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await browserExpect(page.getByRole('status')).toContainText('Saved to your account.');
    await page.reload();
    await browserExpect(page.getByText('Alice revised evidence', { exact: true })).toBeVisible();
    mkdirSync('.fleet/evidence/account-pdf-notes', { recursive: true });
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.screenshot({
        path: `.fleet/evidence/account-pdf-notes/after-${width}.png`,
        fullPage: true,
        animations: 'disabled',
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false
      );
    }
    for (const method of ['PUT', 'GET']) {
      await page.getByRole('button', { name: 'Edit note', exact: true }).click();
      await page
        .getByRole('textbox', { name: 'Page note', exact: true })
        .fill(`Alice delayed ${method} evidence`);
      holdMethod = method;
      releaseResponse = undefined;
      await page.getByRole('button', { name: 'Save changes', exact: true }).click();
      await browserExpect.poll(() => Boolean(releaseResponse)).toBe(true);
      await browserExpect(
        page.getByRole('textbox', { name: 'Page note', exact: true })
      ).toBeDisabled();
      // Refresh the real client session in the same SPA with Alice's save pending.
      await context.addCookies([{ name: 'fixture-user', value: 'bob', url: origin }]);
      await browserExpect
        .poll(
          async () => {
            await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
            return page.getByText('Document not found.', { exact: true }).isVisible();
          },
          { timeout: 15000 }
        )
        .toBe(true);
      const lateRead = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/articles/alice-pdf') &&
          response.request().method() === 'GET'
      );
      releaseResponse?.();
      await lateRead;
      await browserExpect(page.getByText('Document not found.', { exact: true })).toBeVisible();
      await browserExpect(
        page.getByRole('textbox', { name: 'Page note', exact: true })
      ).toHaveCount(0);
      await browserExpect(
        page.getByText(`Alice delayed ${method} evidence`, { exact: true })
      ).toHaveCount(0);
      if (method === 'PUT') {
        await context.addCookies([{ name: 'fixture-user', value: 'alice', url: origin }]);
        await page.goto(`${origin}/reader/alice-pdf`);
        await browserExpect(
          page.getByText('Alice delayed PUT evidence', { exact: true })
        ).toBeVisible();
      }
    }
    expect(
      (
        await context.request.put(`${origin}/api/articles/alice-pdf`, { data: { notes: [] } })
      ).status()
    ).toBe(404);
    await page.goto(`${origin}/reader/bob-pdf`);
    await browserExpect(
      page.getByText('Synthetic research page one', { exact: true })
    ).toBeVisible();
    await browserExpect(page.getByRole('textbox', { name: 'Page note', exact: true })).toHaveValue(
      ''
    );
    await page
      .getByRole('textbox', { name: 'Page note', exact: true })
      .fill('Bob page one evidence');
    await page.getByRole('button', { name: 'Save note', exact: true }).click();
    await browserExpect(page.getByRole('status')).toContainText('Saved to your account.');
    await page.reload();
    await browserExpect(page.getByText('Bob page one evidence', { exact: true })).toBeVisible();
    await context.addCookies([{ name: 'fixture-user', value: 'alice', url: origin }]);
    await page.goto(`${origin}/reader/alice-pdf`);
    await browserExpect(
      page.getByText('Alice delayed GET evidence', { exact: true })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Delete note', exact: true }).click();
    await browserExpect(page.getByRole('status')).toContainText('Saved to your account.');
    await page.reload();
    await browserExpect(page.getByText('No page notes yet.', { exact: true })).toBeVisible();
    expect((await (await request(app, 'alice', 'alice-pdf')).json()).notes).toEqual([]);
    expect((await (await request(app, 'bob', 'bob-pdf')).json()).notes[0]).toMatchObject({
      text: 'Bob page one evidence',
      anchor: { pageNumber: 1 },
    });
    expect(writes).toHaveLength(8);
    expect(errors).toEqual([]);
    expect(
      external.every((host) =>
        ['www.clarity.ms', 'us-assets.i.posthog.com', 'us.i.posthog.com'].includes(host)
      )
    ).toBe(true);
  } finally {
    releaseResponse?.();
    await browser.close();
    await new Promise<void>((resolve) => server.close(resolve));
    sqlite.close();
  }
});
