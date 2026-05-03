import { describe, expect, it } from 'vitest';
import { canImportPage, getImportNotice } from '../importQuality';
import type { PageContent } from '../types';

function page(overrides: Partial<PageContent> = {}): PageContent {
  return {
    title: 'Article',
    byline: null,
    content: 'Readable article content '.repeat(80),
    textContent: 'Readable article content '.repeat(80),
    siteName: 'Example',
    url: 'https://example.com/posts/story',
    ...overrides,
  };
}

describe('getImportNotice', () => {
  it('flags missing page content', () => {
    expect(getImportNotice(null)?.title).toContain('cannot be imported');
    expect(getImportNotice(null)?.blocking).toBe(true);
    expect(canImportPage(null)).toBe(false);
  });

  it('flags restricted browser protocols', () => {
    const restrictedPage = page({ url: 'chrome://extensions' });
    expect(getImportNotice(restrictedPage)?.message).toContain('Chrome blocks');
    expect(getImportNotice(restrictedPage)?.blocking).toBe(true);
    expect(canImportPage(restrictedPage)).toBe(false);
  });

  it('flags fallback extraction', () => {
    expect(getImportNotice(page(), true)?.title).toContain('cleanup');
    expect(canImportPage(page(), true)).toBe(true);
  });

  it('flags likely authenticated app pages', () => {
    expect(
      getImportNotice(page({ url: 'https://example.com/dashboard/project' }))?.title
    ).toContain('authenticated');
  });

  it('does not flag normal article pages', () => {
    expect(getImportNotice(page())).toBeNull();
  });
});
