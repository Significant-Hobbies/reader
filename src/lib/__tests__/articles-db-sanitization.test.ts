import { describe, expect, it, vi } from 'vitest';

vi.mock('../db/client', () => ({ db: {} }));
vi.mock('../memories-db', () => ({ findMemoryByUrl: vi.fn(), createMemoryRecord: vi.fn() }));

import { sanitizeArticlePayload } from '../articles-db';
import { sanitizeBrowserMemorySnapshot } from '../browser-memory-import';

const sourceUrl = 'https://source.example/articles/story?edition=1#intro';
const sanitize = (content: string, url = sourceUrl) =>
  sanitizeArticlePayload({ content, url, userId: 'synthetic-user' }).content;

describe('article source URL sanitization', () => {
  it.each([
    ['/explore/', 'https://source.example/explore/'],
    ['/insights/?topic=ai#latest', 'https://source.example/insights/?topic=ai#latest'],
    ['next?edition=2#details', 'https://source.example/articles/next?edition=2#details'],
    ['../archive/', 'https://source.example/archive/'],
    ['?edition=2#details', 'https://source.example/articles/story?edition=2#details'],
    ['//cdn.example/image.png', 'https://cdn.example/image.png'],
  ])('resolves href and src %s using the full source URL', (relative, absolute) => {
    const content = sanitize(`<a href="${relative}">link</a><img src="${relative}" />`);
    expect(content).toContain(`href="${absolute}"`);
    expect(content).toContain(`src="${absolute}"`);
  });

  it('uses the source protocol and directory or trailing slash', () => {
    expect(sanitize('<img src="//cdn.example/image.png" />', 'http://source.example/')).toContain(
      'src="http://cdn.example/image.png"'
    );
    expect(sanitize('<a href="next">link</a>', 'https://source.example/articles/')).toContain(
      'href="https://source.example/articles/next"'
    );
  });

  it('keeps local fragments and safe markup unchanged', () => {
    const html =
      '<h2 id="details">Details</h2><p class="body"><strong>Text</strong> ' +
      '<a href="#details">jump</a><a href="https://other.example/path?x=1#part">external</a>' +
      '<a href="mailto:reader@example.org">email</a></p><img src="data:image/png;base64,AA==" />';
    expect(sanitize(html)).toBe(html);
    expect(sanitize(sanitize(html))).toBe(html);
  });

  it.each([
    'javascript:alert(1)',
    'jav&#x61;script:alert(1)',
    'java&#10;script:alert(1)',
    'vbscript:alert(1)',
    'file:///private/file',
    'blob:https://source.example/id',
    'data:text/html,unsafe',
  ])('rejects unsafe scheme %s', (url) => {
    const html = sanitize(
      `<a href="${url}">link</a><img src="${url}" /><iframe src="${url}"></iframe>`
    );
    expect(html).not.toContain('href=');
    if (!url.startsWith('data:')) expect(html).not.toContain('src=');
    // Images retain the existing data: allowance; links and frames do not.
    expect(html).not.toContain('<iframe src=');
  });

  it('retains sanitization and iframe host restrictions', () => {
    const html = sanitize(
      '<base href="https://untrusted.example/"><script>alert(1)</script>' +
        '<p onclick="alert(1)">Text</p><iframe src="//untrusted.example/embed"></iframe>' +
        '<iframe src="//www.youtube.com/embed/synthetic"></iframe>'
    );
    expect(html).not.toMatch(/<base|<script|onclick|untrusted\.example/);
    expect(html).toContain('src="https://www.youtube.com/embed/synthetic"');
  });

  it('does not use an invalid or unsafe source as a base', () => {
    expect(sanitize('<a href="javascript:alert(1)">link</a>', 'javascript:alert(1)')).toBe(
      '<a>link</a>'
    );
    expect(sanitize('<p>Text</p>', 'not a URL')).toBe('<p>Text</p>');
  });

  it('resolves browser-memory imports through the real shared sanitizer', () => {
    const result = sanitizeBrowserMemorySnapshot({
      url: sourceUrl,
      content: '<a href="/insights/">link</a><img src="../image.png" /><a href="#intro">jump</a>',
    });
    expect(result).toHaveProperty('snapshot');
    if ('snapshot' in result) {
      expect(result.snapshot.content).toBe(
        '<a href="https://source.example/insights/">link</a>' +
          '<img src="https://source.example/image.png" /><a href="#intro">jump</a>'
      );
    }
  });
});
