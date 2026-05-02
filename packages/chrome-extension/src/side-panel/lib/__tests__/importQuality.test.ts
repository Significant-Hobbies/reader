import { describe, expect, it } from 'vitest';
import { getImportNotice } from '../importQuality';
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
  });

  it('flags restricted browser protocols', () => {
    expect(getImportNotice(page({ url: 'chrome://extensions' }))?.message).toContain(
      'Chrome blocks'
    );
  });

  it('flags fallback extraction', () => {
    expect(getImportNotice(page(), true)?.title).toContain('cleanup');
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
