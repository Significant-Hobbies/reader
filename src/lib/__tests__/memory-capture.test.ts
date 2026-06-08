import { describe, expect, it } from 'vitest';

import { searchMemoryCaptures } from '../memory-capture';
import {
  buildPrototypeCorpus,
  ingestMemoryCaptureFixtures,
  mockBrowserMemoryImport,
} from '../memory-capture-fixtures';

describe('memory-capture prototype', () => {
  it('loads fixture captures for web page, blog article, and PDF-like document', () => {
    const captures = ingestMemoryCaptureFixtures();
    const kinds = captures.map((c) => c.kind);
    expect(kinds).toContain('web_page');
    expect(kinds).toContain('blog_article');
    expect(kinds).toContain('pdf_document');

    const pdf = captures.find((c) => c.kind === 'pdf_document');
    expect(pdf?.blogOriginUrl).toMatch(/blog\.example\.com/);
    expect(pdf?.body).toContain('Marginalia');
  });

  it('mock browser-memory import does not require extension permissions', () => {
    const { captures, errors } = mockBrowserMemoryImport();
    expect(captures.length).toBeGreaterThanOrEqual(2);
    expect(errors).toHaveLength(0);
    expect(captures.every((c) => c.tags.includes('browser-memory'))).toBe(true);
  });

  it('search returns snippet, source, timestamp, and annotation context', () => {
    const corpus = buildPrototypeCorpus();
    const hits = searchMemoryCaptures(corpus, 'queryable');

    expect(hits.length).toBeGreaterThan(0);
    const hit = hits[0];
    expect(hit.snippet.length).toBeGreaterThan(0);
    expect(hit.source.url).toBeTruthy();
    expect(hit.source.kind).toBeTruthy();
    expect(hit.capturedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(hit.matchedFields.length).toBeGreaterThan(0);
  });

  it('finds PDF marginalia and blog annotations across the corpus', () => {
    const corpus = buildPrototypeCorpus();

    const pdfHits = searchMemoryCaptures(corpus, 'marginalia');
    expect(pdfHits.some((h) => h.source.kind === 'pdf_document')).toBe(true);
    expect(pdfHits.some((h) => h.annotationContext?.includes('consolidation'))).toBe(true);

    const blogHits = searchMemoryCaptures(corpus, 'Feynman');
    expect(blogHits.some((h) => h.source.kind === 'blog_article')).toBe(true);

    const annotationHits = searchMemoryCaptures(corpus, 'teach to learn');
    expect(annotationHits.some((h) => h.matchedFields.includes('annotations'))).toBe(true);
    expect(annotationHits.some((h) => h.annotationContext?.includes('explain'))).toBe(true);
  });

  it('query across all captures includes browser-memory fixture rows', () => {
    const corpus = buildPrototypeCorpus();
    const hits = searchMemoryCaptures(corpus, 'distributional');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.captureId.startsWith('fixture-'))).toBe(true);
  });
});
