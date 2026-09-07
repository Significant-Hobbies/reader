import { mkdirSync } from 'node:fs';
import { chromium, expect as browserExpect, type Page } from '@playwright/test';
import { expect, test, vi } from 'vitest';
import { accountFixture } from './account-handler-fixture';
import { serveBuiltReader } from './pdf-browser-fixture.mjs';

vi.mock('../src/lib/auth-api', () => ({
  getAuthenticatedUserId: async (headers: Headers) =>
    headers.get('cookie')?.match(/fixture-user=(alice|bob)/)?.[1] ?? null,
}));

test('article reopen uses current persisted annotations instead of overwriting them from stale reader cache', async () => {
  const { sqlite, app } = accountFixture();
  const content =
    '<h2>Synthetic field notes</h2><p id="synthetic-evidence">A measured sample preserves the source evidence.</p><p id="synthetic-second">Keep the denominator explicit.</p>';
  sqlite
    .prepare(
      "UPDATE articles SET type = 'article', content = ?, pdf_storage_key = NULL WHERE id = 'alice-pdf'"
    )
    .run(content);
  const oldNote = {
    id: 1,
    text: 'Initial account observation',
    anchor: {
      elementIndex: 1,
      tagName: 'p',
      textPreview: 'A measured sample preserves the source evidence.',
    },
  };
  sqlite
    .prepare("UPDATE articles SET notes = ? WHERE id = 'alice-pdf'")
    .run(JSON.stringify([oldNote]));
  const writes: unknown[] = [];
  const { server, origin } = await serveBuiltReader(async (req: Request) => {
    const url = new URL(req.url);
    if (url.pathname === '/api/auth/get-session')
      return Response.json({
        session: { id: 'alice-session', userId: 'alice', expiresAt: '2099-01-01T00:00:00Z' },
        user: { id: 'alice', name: 'alice', email: 'alice@example.invalid' },
      });
    if (url.pathname.startsWith('/api/articles/')) {
      if (req.method === 'PUT') writes.push(await req.clone().json());
      return app.fetch(req);
    }
    return Response.json({ error: 'Auxiliary fixture service unavailable' }, { status: 503 });
  });
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addCookies([{ name: 'fixture-user', value: 'alice', url: origin }]);
    await context.route('**/*', (route) =>
      new URL(route.request().url()).origin === origin ? route.continue() : route.abort()
    );
    const page = await context.newPage();
    await page.goto(`${origin}/reader/alice-pdf`);
    await browserExpect(
      page.getByRole('button', { name: 'Initial account observation', exact: true })
    ).toBeVisible();
    // Navigate without destroying the real QueryClient, then update the source.
    await page.evaluate(() => {
      history.pushState({}, '', '/extension');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await browserExpect(
      page.getByRole('button', { name: 'Initial account observation', exact: true })
    ).toHaveCount(0);
    sqlite.prepare("UPDATE articles SET notes = ? WHERE id = 'alice-pdf'").run(
      JSON.stringify([
        { ...oldNote, text: 'Fresh server observation' },
        { ...oldNote, id: 2, text: 'Second server observation' },
      ])
    );
    await page.evaluate(() => {
      history.pushState({}, '', '/reader/alice-pdf');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await browserExpect(
      page.getByRole('button', { name: 'Fresh server observation', exact: true })
    ).toBeVisible();
    expect(
      JSON.parse(
        String(sqlite.prepare("SELECT notes FROM articles WHERE id = 'alice-pdf'").get()?.notes)
      )[0].text
    ).toBe('Fresh server observation');
    expect(writes).toEqual([]);
    await addSelectedNote(page);
    await browserExpect(page.getByText('Notes saved', { exact: true }).first()).toBeVisible();
    const refreshedNotes = JSON.parse(
      String(sqlite.prepare("SELECT notes FROM articles WHERE id = 'alice-pdf'").get()?.notes)
    );
    expect(refreshedNotes).toHaveLength(3);
    expect(new Set(refreshedNotes.map((note: { id: number }) => note.id)).size).toBe(3);
    expect(refreshedNotes.map((note: { text: string }) => note.text)).toContain(
      'Second server observation'
    );
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.close(resolve));
    sqlite.close();
  }
});

async function addSelectedNote(page: Page) {
  await page.locator('#synthetic-evidence').evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    const rect = element.getBoundingClientRect();
    element.dispatchEvent(
      new MouseEvent('mouseup', { bubbles: true, clientX: rect.left + 10, clientY: rect.top + 10 })
    );
  });
  await page.getByRole('button', { name: 'Add note', exact: true }).click();
}

test('account article selection notes survive retry, edit, reload and delete with account-switch isolation', async () => {
  const { sqlite, app } = accountFixture();
  const text = 'A measured sample preserves the source evidence.';
  for (const user of ['alice', 'bob']) {
    sqlite
      .prepare(
        "UPDATE articles SET type = 'article', title = ?, content = ?, pdf_storage_key = NULL WHERE id = ?"
      )
      .run(
        `${user} synthetic article`,
        `<h2>Synthetic field notes</h2><p id="synthetic-evidence">${text}</p><p id="synthetic-second">Keep the denominator explicit.</p>`,
        `${user}-pdf`
      );
  }
  let failNextSave = false;
  let holdNextSave = false;
  let releaseSave: (() => void) | undefined;
  const writes: string[] = [];
  const { server, origin } = await serveBuiltReader(async (req: Request) => {
    const url = new URL(req.url);
    const user = req.headers.get('cookie')?.match(/fixture-user=(alice|bob)/)?.[1];
    if (url.pathname === '/api/auth/get-session')
      return Response.json(
        user
          ? {
              session: { id: `${user}-session`, userId: user, expiresAt: '2099-01-01T00:00:00Z' },
              user: { id: user, name: user, email: `${user}@example.invalid` },
            }
          : null
      );
    if (url.pathname.startsWith('/api/articles/')) {
      if (req.method === 'PUT') {
        writes.push(`${user}:${url.pathname}`);
        if (failNextSave) {
          failNextSave = false;
          return Response.json({ error: 'Synthetic unavailable' }, { status: 503 });
        }
        if (holdNextSave) {
          holdNextSave = false;
          await new Promise<void>((resolve) => {
            releaseSave = resolve;
          });
        }
      }
      return app.fetch(req);
    }
    return Response.json({ error: 'Auxiliary fixture service unavailable' }, { status: 503 });
  });
  const browser = await chromium.launch();
  const errors: string[] = [];
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addCookies([{ name: 'fixture-user', value: 'alice', url: origin }]);
    await context.route('**/*', (route) =>
      new URL(route.request().url()).origin === origin ? route.continue() : route.abort()
    );
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${origin}/reader/alice-pdf`);
    await browserExpect(page.locator('#synthetic-evidence')).toHaveText(text);
    failNextSave = true;
    await addSelectedNote(page);
    await browserExpect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
    const failedWriteCount = writes.length;
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(writes).toHaveLength(failedWriteCount);
    expect(
      JSON.parse(
        String(sqlite.prepare("SELECT notes FROM articles WHERE id = 'alice-pdf'").get()?.notes)
      )
    ).toEqual([]);
    await browserExpect(page.getByRole('button', { name: text, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await browserExpect(page.getByText('Notes saved', { exact: true }).first()).toBeVisible();
    await page.reload();
    await browserExpect(page.getByRole('button', { name: text, exact: true })).toBeVisible();
    const saved = JSON.parse(
      String(sqlite.prepare("SELECT notes FROM articles WHERE id = 'alice-pdf'").get()?.notes)
    );
    expect(saved).toHaveLength(1);
    expect(saved[0].anchor).toMatchObject({ elementIndex: 1, tagName: 'p', textPreview: text });
    await page.getByRole('button', { name: text, exact: true }).click();
    await page.getByPlaceholder('Write your observation...').fill('Alice revised selection note');
    await browserExpect(page.getByText('Notes saved', { exact: true }).first()).toBeVisible();
    await page.reload();
    await browserExpect(
      page.getByRole('button', { name: 'Alice revised selection note', exact: true })
    ).toBeVisible();
    mkdirSync('.fleet/evidence/account-article', { recursive: true });
    await page.screenshot({
      path: '.fleet/evidence/account-article/after-1440.png',
      fullPage: true,
      animations: 'disabled',
    });
    await page.setViewportSize({ width: 390, height: 1000 });
    await browserExpect(
      page.getByRole('button', { name: 'Close sidebar', exact: true })
    ).toBeVisible();
    await page.screenshot({
      path: '.fleet/evidence/account-article/notes-390.png',
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByRole('button', { name: 'Close sidebar', exact: true }).click();
    await browserExpect(page.locator('#synthetic-evidence')).toBeVisible();
    await page.screenshot({
      path: '.fleet/evidence/account-article/read-390.png',
      fullPage: true,
      animations: 'disabled',
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false
    );
    await page.getByRole('button', { name: 'Show notes sidebar (1)', exact: true }).click();
    await browserExpect(
      page.getByRole('button', { name: 'Alice revised selection note', exact: true })
    ).toBeVisible();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'Alice revised selection note', exact: true }).click();
    holdNextSave = true;
    await page.getByPlaceholder('Write your observation...').fill('Alice first pending edit');
    await browserExpect.poll(() => Boolean(releaseSave)).toBe(true);
    const writesWhileHeld = writes.length;
    await page.getByPlaceholder('Write your observation...').fill('Alice newer unsaved note');
    sqlite
      .prepare("UPDATE articles SET notes = ? WHERE id = 'alice-pdf'")
      .run(JSON.stringify([{ ...saved[0], text: 'Concurrent server observation' }]));
    const freshRead = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' && response.url().endsWith('/api/articles/alice-pdf')
    );
    await page.evaluate(() =>
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
    );
    await freshRead;
    await browserExpect(page.getByPlaceholder('Write your observation...')).toHaveValue(
      'Alice newer unsaved note'
    );
    await page.locator('#synthetic-second').scrollIntoViewIfNeeded();
    await page.locator('.annotation-marker').scrollIntoViewIfNeeded();
    const marker = await page.locator('.annotation-marker').boundingBox();
    const target = await page.locator('#synthetic-second').boundingBox();
    expect(marker).not.toBeNull();
    expect(target).not.toBeNull();
    await page.mouse.move(marker!.x + marker!.width / 2, marker!.y + marker!.height / 2);
    await page.mouse.down();
    await page.mouse.move(target!.x + 20, target!.y + target!.height / 2, { steps: 10 });
    await page.mouse.up();
    await browserExpect(page.locator('#synthetic-second .annotation-marker')).toHaveCount(1);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(writes).toHaveLength(writesWhileHeld);
    releaseSave?.();
    await browserExpect
      .poll(
        () =>
          JSON.parse(
            String(sqlite.prepare("SELECT notes FROM articles WHERE id = 'alice-pdf'").get()?.notes)
          )[0].text
      )
      .toBe('Alice newer unsaved note');
    await browserExpect(page.getByText('Notes saved', { exact: true }).first()).toBeVisible();
    expect(
      JSON.parse(
        String(sqlite.prepare("SELECT notes FROM articles WHERE id = 'alice-pdf'").get()?.notes)
      )[0].anchor.elementIndex
    ).toBe(2);
    releaseSave = undefined;
    holdNextSave = true;
    await page.getByPlaceholder('Write your observation...').fill('Alice delayed private note');
    await browserExpect.poll(() => Boolean(releaseSave)).toBe(true);
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
    const lateWrite = page.waitForResponse((response) => response.request().method() === 'PUT');
    releaseSave?.();
    await lateWrite;
    await browserExpect(page.getByPlaceholder('Write your observation...')).toHaveCount(0);
    await browserExpect(page.getByText('Alice delayed private note', { exact: true })).toHaveCount(
      0
    );
    expect(
      (
        await context.request.put(`${origin}/api/articles/alice-pdf`, { data: { notes: [] } })
      ).status()
    ).toBe(404);
    await page.goto(`${origin}/reader/bob-pdf`);
    await browserExpect(page.getByText('No notes yet', { exact: true })).toBeVisible();
    await addSelectedNote(page);
    await browserExpect(page.getByText('Notes saved', { exact: true }).first()).toBeVisible();
    await page.reload();
    await browserExpect(page.getByRole('button', { name: text, exact: true })).toBeVisible();
    await context.addCookies([{ name: 'fixture-user', value: 'alice', url: origin }]);
    await page.goto(`${origin}/reader/alice-pdf`);
    await browserExpect(
      page.getByRole('button', { name: 'Alice delayed private note', exact: true })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Delete note 1', exact: true }).click();
    await browserExpect(page.getByText('Notes saved', { exact: true }).first()).toBeVisible();
    await page.reload();
    await browserExpect(page.getByText('No notes yet', { exact: true })).toBeVisible();
    expect(
      JSON.parse(
        String(sqlite.prepare("SELECT notes FROM articles WHERE id = 'alice-pdf'").get()?.notes)
      )
    ).toEqual([]);
    expect(
      JSON.parse(
        String(sqlite.prepare("SELECT notes FROM articles WHERE id = 'bob-pdf'").get()?.notes)
      )
    ).toHaveLength(1);
    expect(errors).toEqual([]);
    expect(writes).toHaveLength(9);
  } finally {
    releaseSave?.();
    await browser.close();
    await new Promise<void>((resolve) => server.close(resolve));
    sqlite.close();
  }
});
