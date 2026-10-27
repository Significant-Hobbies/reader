import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { publicRoutes, publicPages } from '../src/public-site.mjs';

test('public Reader build covers the source registry', async () => {
  const root = resolve(import.meta.dirname, '..');
  const registered = new Set(publicRoutes.map((route) => route.path));
  const emitted = new Set();
  for (const entry of await readdir(resolve(root, 'landing-astro/dist'), { recursive: true })) {
    if (!entry.endsWith('.html')) continue;
    const html = await readFile(resolve(root, 'landing-astro/dist', entry), 'utf8');
    const path =
      `/${entry.replace(/(?:^|\/)index\.html$/, '').replace(/\.html$/, '')}`.replace(/\/$/, '') ||
      '/';
    if (/name="robots"[^>]*content="[^"]*noindex/.test(html)) {
      assert.ok(!registered.has(path), `Noindex page registered: ${path}`);
      continue;
    }
    assert.ok(registered.has(path), `Public HTML missing Markdown renderer: ${path}`);
    assert.ok(html.includes('name="ai-summary"'), `Missing AI summary: ${path}`);
    assert.ok(html.includes('type="text/markdown"'), `Missing Markdown alternate: ${path}`);
    emitted.add(path);
  }
  // /privacy is the existing public React view. Its server head is supplied by the
  // Worker, and its copy is shared with the renderer; account SPA views are excluded.
  assert.ok(
    (await readFile(resolve(root, 'src/pages/PrivacyPage.tsx'), 'utf8')).includes(
      'copy.privacy.paragraphs'
    )
  );
  emitted.add('/privacy');
  assert.deepEqual(
    [...emitted].sort((a, b) => a.localeCompare(b)),
    [...registered].sort((a, b) => a.localeCompare(b))
  );
  for (const route of publicRoutes) {
    const markdown = await readFile(
      resolve(root, 'dist', new URL(route.md).pathname.slice(1)),
      'utf8'
    );
    assert.equal(markdown, publicPages[route.path]);
    assert.ok(markdown.includes(`Canonical: ${route.url}`));
  }
  const sitemap = await readFile(resolve(root, 'dist/sitemap.xml'), 'utf8');
  assert.deepEqual(
    [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((item) => item[1])
      .sort((a, b) => a.localeCompare(b)),
    publicRoutes.map((route) => route.url).sort((a, b) => a.localeCompare(b))
  );
  assert.ok((await readFile(resolve(root, 'dist/llms-full.txt'), 'utf8')).length < 500000);
  console.log(`Verified ${registered.size} public Reader pages; account SPA views excluded.`);
});
