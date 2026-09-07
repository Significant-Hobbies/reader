import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import ts from 'typescript';

// Exercise the real storage module in an isolated browser, without starting the
// Worker, loading credentials, or contacting any hosted service.
test('local storage preserves concurrent edits across reload', async () => {
  const source = await readFile(new URL('../src/lib/local-library.ts', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route('**/*', (route) =>
      route.fulfill({
        contentType: route.request().url().endsWith('.js') ? 'text/javascript' : 'text/html',
        body: route.request().url().endsWith('.js')
          ? outputText
          : '<!doctype html><title>Synthetic local library</title>',
      })
    );
    await page.goto('https://reader.test');
    const moduleUrl = 'https://reader.test/local-library.js';
    const saved = await page.evaluate(async (url) => {
      const lib = await import(url);
      const file = new File(['%PDF-1.4\nSynthetic storage fixture\n%%EOF'], 'synthetic.pdf', {
        type: 'application/pdf',
      });
      const pdfUrl = await lib.fileToDataUrl(file);
      const pdf = await lib.saveLocalArticle({
        title: 'Synthetic PDF',
        url: 'local-pdf://synthetic.pdf',
        content: '',
        type: 'pdf',
        pdfUrl,
      });
      const article = await lib.saveLocalArticle({
        title: 'Synthetic article',
        url: 'https://example.invalid/synthetic',
        content: '<p>A synthetic reading passage.</p>',
        type: 'article',
      });
      const notes = [
        {
          id: 1,
          text: 'Keep this note',
          anchor: { elementIndex: 0, textPreview: 'A synthetic reading passage.' },
        },
      ];
      await Promise.all([
        lib.updateLocalArticle(article.id, { notes }),
        lib.updateLocalArticle(article.id, { title: 'Revised title' }),
      ]);
      const missing = await lib.updateLocalArticle('missing-fixture', {}).then(
        () => null,
        (error) => error.message
      );
      return { articleId: article.id, pdfId: pdf.id, pdfUrl, notes, missing };
    }, moduleUrl);
    await page.reload();
    const restored = await page.evaluate(
      async ({ url, articleId, pdfId }) => {
        const lib = await import(url);
        return {
          article: await lib.getLocalArticle(articleId),
          pdf: await lib.getLocalArticle(pdfId),
        };
      },
      { url: moduleUrl, ...saved }
    );
    assert.equal(saved.missing, 'Local item not found');
    assert.equal(restored.article.title, 'Revised title');
    assert.deepEqual(restored.article.notes, saved.notes);
    assert.equal(restored.article.notesCount, 1);
    assert.equal(restored.article.content, '<p>A synthetic reading passage.</p>');
    assert.equal(restored.article.userId, 'local');
    assert.equal(restored.pdf.pdfUrl, saved.pdfUrl);
    console.log(
      'PASS: local article content, concurrent title/note edits, note count, and synthetic PDF bytes survive page reload. No network services used.'
    );
  } finally {
    await browser.close();
  }
});
