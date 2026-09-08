import { mkdirSync } from 'node:fs';
import type { Hono } from 'hono';
import { chromium, expect as browserExpect } from '@playwright/test';
import { expect, test, vi } from 'vitest';
import { accountFixture } from './account-handler-fixture';
import { boardNotes, BoardNoteSync } from '../src/lib/board-note-sync';
import { serveBuiltReader, syntheticPdf } from './pdf-browser-fixture.mjs';

// Authentication is the only mocked application boundary. Article ownership,
// validation, Drizzle queries and SQLite persistence run unchanged.
vi.mock('../src/lib/auth-api', () => ({
  getAuthenticatedUserId: async (headers: Headers) =>
    headers.get('cookie')?.match(/fixture-user=(alice|bob)/)?.[1] ?? null,
}));

async function request(
  app: Hono,
  user: string,
  id: string,
  notes?: unknown[],
  baseNotes?: unknown[]
) {
  const base =
    notes && baseNotes === undefined
      ? ((await (await request(app, user, id)).json()).notes ?? [])
      : baseNotes;
  return app.request(`/api/articles/${id}`, {
    method: notes ? 'PUT' : 'GET',
    headers: { cookie: `fixture-user=${user}`, 'content-type': 'application/json' },
    ...(notes ? { body: JSON.stringify({ notes, baseNotes: base }) } : {}),
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

test('concurrent note edits merge independent changes and reject overlapping stale writes atomically', async () => {
  const { sqlite, app } = accountFixture();
  try {
    const initial = [{ id: 1, text: 'Shared baseline' }];
    expect((await request(app, 'alice', 'alice-pdf', initial, [])).status).toBe(200);
    const added = [...initial, { id: 2, text: 'Other device evidence' }];
    const revised = [{ id: 1, text: 'First note revised' }];
    const writes = await Promise.all([
      request(app, 'alice', 'alice-pdf', added, initial),
      request(app, 'alice', 'alice-pdf', revised, initial),
    ]);
    expect(writes.map((response) => response.status)).toEqual([200, 200]);
    let saved = (await (await request(app, 'alice', 'alice-pdf')).json()).notes;
    expect(saved).toEqual([...revised, added[1]]);
    const conflict = await request(
      app,
      'alice',
      'alice-pdf',
      [{ id: 1, text: 'Stale replacement' }],
      initial
    );
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({ code: 'note_conflict' });
    expect((await (await request(app, 'alice', 'alice-pdf')).json()).notes).toEqual(saved);
    // Retrying a request whose successful acknowledgement was lost is harmless.
    expect((await request(app, 'alice', 'alice-pdf', revised, initial)).status).toBe(200);
    // Delete one note without deleting another editor's independent addition.
    expect((await request(app, 'alice', 'alice-pdf', [], revised)).status).toBe(200);
    saved = (await (await request(app, 'alice', 'alice-pdf')).json()).notes;
    expect(saved).toEqual([added[1]]);
    const unversioned = await app.request('/api/articles/alice-pdf', {
      method: 'PUT',
      headers: { cookie: 'fixture-user=alice', 'content-type': 'application/json' },
      body: JSON.stringify({ notes: [] }),
    });
    expect(unversioned.status).toBe(400);
    expect((await (await request(app, 'alice', 'alice-pdf')).json()).notes).toEqual(saved);
    expect((await request(app, 'alice', 'alice-pdf', [added[1], added[1]], saved)).status).toBe(
      400
    );
  } finally {
    sqlite.close();
  }
});

test('board note synchronization preserves unrelated notes, stable identities and failed edits', async () => {
  const { sqlite, app } = accountFixture();
  const nodes = [
    {
      id: 'one',
      type: 'note',
      position: { x: 0, y: 0 },
      data: {
        text: 'First board thought',
        elementAnchor: { articleId: 'alice-pdf', websiteNodeId: 'web', elementIndex: 0 },
      },
    },
    {
      id: 'two',
      type: 'note',
      position: { x: 0, y: 0 },
      data: {
        text: 'Second board thought',
        elementAnchor: { articleId: 'alice-pdf', websiteNodeId: 'web', elementIndex: 1 },
      },
    },
  ];
  let fail = false;
  vi.stubGlobal('fetch', async (input: string, init?: RequestInit) => {
    if (fail && init?.method === 'PUT') {
      fail = false;
      return Response.json({}, { status: 503 });
    }
    return app.request(input, {
      ...init,
      headers: { ...init?.headers, cookie: 'fixture-user=alice' },
    });
  });
  try {
    const personal = [{ id: 1, text: 'Article note unrelated to this board' }];
    await request(app, 'alice', 'alice-pdf', personal, []);
    const linked = boardNotes('board-a', nodes).get('alice-pdf')!;
    const sync = new BoardNoteSync(new Map());
    await sync.save('alice-pdf', linked);
    let saved = (await (await request(app, 'alice', 'alice-pdf')).json()).notes;
    expect(saved).toHaveLength(3);
    expect(saved).toEqual(expect.arrayContaining(personal));
    expect(boardNotes('board-a', [...nodes].reverse()).get('alice-pdf')).toEqual(linked);
    const remaining = boardNotes('board-a', nodes.slice(1)).get('alice-pdf')!;
    await sync.save('alice-pdf', remaining);
    saved = (await (await request(app, 'alice', 'alice-pdf')).json()).notes;
    expect(saved).toHaveLength(2);
    expect(saved).toEqual(
      expect.arrayContaining([
        ...personal,
        expect.objectContaining({ id: remaining[0].id, sourceKey: remaining[0].sourceKey }),
      ])
    );
    const first = new BoardNoteSync(new Map([['alice-pdf', remaining]]));
    const second = new BoardNoteSync(new Map([['alice-pdf', remaining]]));
    const revised = [{ ...remaining[0], text: 'Revised on first device' }];
    fail = true;
    await expect(first.save('alice-pdf', revised)).rejects.toThrow('Could not save notes');
    expect((await (await request(app, 'alice', 'alice-pdf')).json()).notes).toEqual(saved);
    await first.save('alice-pdf', revised);
    await expect(
      second.save('alice-pdf', [{ ...remaining[0], text: 'Stale second-device edit' }])
    ).rejects.toThrow('another editor');
    const otherBoard = boardNotes('board-b', nodes.slice(1)).get('alice-pdf')!;
    expect(otherBoard[0].id).not.toBe(remaining[0].id);
    await new BoardNoteSync(new Map()).save('alice-pdf', otherBoard);
    saved = (await (await request(app, 'alice', 'alice-pdf')).json()).notes;
    expect(saved).toHaveLength(3);
    expect(saved).toEqual(
      expect.arrayContaining([
        ...personal,
        expect.objectContaining({ text: revised[0].text }),
        expect.objectContaining({ sourceKey: otherBoard[0].sourceKey }),
      ])
    );
  } finally {
    vi.unstubAllGlobals();
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

test('built board edits retry failed linked notes without overwriting article data or leaking across accounts', async () => {
  const { sqlite, app } = accountFixture();
  const node = {
    id: 'linked-thought',
    type: 'note',
    position: { x: 100, y: 100 },
    data: {
      text: 'Board starting thought',
      color: 'yellow',
      elementAnchor: { articleId: 'alice-pdf', websiteNodeId: 'source', elementIndex: 0 },
    },
  };
  sqlite
    .prepare("INSERT INTO boards (id, user_id, name, nodes, edges) VALUES (?, ?, ?, ?, '[]')")
    .run('alice-board', 'alice', 'Synthetic board', JSON.stringify([node]));
  await request(app, 'alice', 'alice-pdf', [{ id: 1, text: 'Independent article evidence' }], []);
  let fail = false;
  const articleWrites: number[] = [];
  const { server, origin } = await serveBuiltReader(async (req: Request) => {
    const path = new URL(req.url).pathname;
    const user = req.headers.get('cookie')?.match(/fixture-user=(alice|bob)/)?.[1];
    if (path === '/api/auth/get-session')
      return Response.json(
        user
          ? {
              session: { id: `${user}-session`, userId: user, expiresAt: '2099-01-01T00:00:00Z' },
              user: { id: user, name: user, email: `${user}@example.invalid` },
            }
          : null
      );
    if (path.startsWith('/api/articles/') && req.method === 'PUT') {
      if (fail) {
        fail = false;
        articleWrites.push(503);
        return Response.json({}, { status: 503 });
      }
      const response = await app.fetch(req);
      articleWrites.push(response.status);
      return response;
    }
    if (path.startsWith('/api/articles/') || path.startsWith('/api/boards/')) return app.fetch(req);
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
    await page.goto(`${origin}/board/alice-board`);
    await browserExpect(page.getByText('Board starting thought', { exact: true })).toBeVisible();
    await page.waitForTimeout(2300);
    expect(articleWrites).toEqual([]);
    expect((await page.locator('.react-flow').boundingBox())?.height).toBe(1000);
    await browserExpect(page.getByText('Board starting thought', { exact: true })).toBeInViewport();
    await page.screenshot({ path: '/tmp/reader-board-after-20260909.png', fullPage: true });
    fail = true;
    await page.getByText('Board starting thought', { exact: true }).dblclick();
    await page.getByPlaceholder('Type your note...').fill('Revised linked evidence');
    await browserExpect(page.getByRole('alert')).toContainText('Could not save notes');
    await browserExpect(page.getByPlaceholder('Type your note...')).toHaveValue(
      'Revised linked evidence'
    );
    expect((await (await request(app, 'alice', 'alice-pdf')).json()).notes).toEqual([
      { id: 1, text: 'Independent article evidence' },
    ]);
    await page.getByRole('button', { name: 'Retry linked sync', exact: true }).click();
    await browserExpect.poll(() => articleWrites).toEqual([503, 200]);
    await browserExpect(page.getByRole('alert')).toHaveCount(0);
    let saved = (await (await request(app, 'alice', 'alice-pdf')).json()).notes;
    expect(saved).toHaveLength(2);
    expect(saved).toEqual(
      expect.arrayContaining([
        { id: 1, text: 'Independent article evidence' },
        expect.objectContaining({ text: 'Revised linked evidence' }),
      ])
    );
    await page.reload();
    await browserExpect(page.getByText('Revised linked evidence', { exact: true })).toBeVisible();
    await page.waitForTimeout(2300);
    expect(articleWrites).toEqual([503, 200]);
    const sourceKey = saved.find((note: { sourceKey?: string }) => note.sourceKey)?.sourceKey;
    saved = saved.map((note: { sourceKey?: string; text: string }) =>
      note.sourceKey === sourceKey ? { ...note, text: 'Edited from the article' } : note
    );
    sqlite
      .prepare("UPDATE articles SET notes = ? WHERE id = 'alice-pdf'")
      .run(JSON.stringify(saved));
    await page.getByText('Revised linked evidence', { exact: true }).dblclick();
    await page.getByPlaceholder('Type your note...').fill('Conflicting board draft');
    await browserExpect(page.getByRole('alert')).toContainText('another editor');
    await browserExpect(page.getByPlaceholder('Type your note...')).toHaveValue(
      'Conflicting board draft'
    );
    expect((await (await request(app, 'alice', 'alice-pdf')).json()).notes).toEqual(saved);
    await context.addCookies([{ name: 'fixture-user', value: 'bob', url: origin }]);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await browserExpect(page.getByText('Board not found.', { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await browserExpect(page.getByPlaceholder('Type your note...')).toHaveCount(0);
    expect((await request(app, 'bob', 'alice-pdf')).status).toBe(404);
    expect(errors).toEqual([]);
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    sqlite.close();
  }
});
