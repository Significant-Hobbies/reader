import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  importBrowserMemorySnapshots,
  isAllowedImportUrl,
  sanitizeBrowserMemorySnapshot,
  stripSensitiveUrlParams,
} from '../browser-memory-import';

vi.mock('../articles-db', () => ({
  findArticleByUrl: vi.fn().mockResolvedValue(null),
  createArticleRecord: vi.fn().mockResolvedValue('article-id-1'),
  normalizeTags: (tags: string[]) => tags.filter(Boolean),
  sanitizeArticlePayload: (payload: {
    url: string;
    title?: string;
    byline?: string;
    content?: string;
    userId: string;
    tags?: string[];
    type?: string;
  }) => ({
    url: payload.url,
    title: payload.title || payload.url,
    byline: payload.byline || '',
    content: payload.content || '',
    userId: payload.userId,
    tags: payload.tags || [],
    type: payload.type || 'article',
    listIds: [],
    category: undefined,
  }),
  sanitizePlainText: (v: unknown) => String(v ?? '').trim(),
  sanitizeTitle: (v: unknown, fallback: string) => String(v ?? fallback).trim(),
}));

// Memories are persisted via memories-db (not articles-db). Mock it so the
// import flow can be exercised without a live D1 binding.
vi.mock('../memories-db', () => ({
  findMemoryByUrl: vi.fn().mockResolvedValue(null),
  createMemoryRecord: vi.fn().mockResolvedValue('memory-id-1'),
}));

const fixturePath = path.join(__dirname, '..', '__fixtures__', 'browser-memory-snapshots.json');

describe('browser-memory-import', () => {
  it('loads fixture snapshots with required readable content', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
      snapshots: Array<{ url: string; content?: string; textContent?: string }>;
    };
    expect(fixture.snapshots.length).toBeGreaterThanOrEqual(2);
    for (const snap of fixture.snapshots) {
      const parsed = sanitizeBrowserMemorySnapshot(snap);
      expect(parsed).toHaveProperty('snapshot');
      if ('snapshot' in parsed) {
        expect(parsed.snapshot.content.length).toBeGreaterThan(0);
      }
    }
  });

  it('strips sensitive query params from URLs', () => {
    const url = stripSensitiveUrlParams(
      'https://news.example.org/story?token=abc&topic=ai&session=xyz'
    );
    expect(url).toBe('https://news.example.org/story?topic=ai');
  });

  it('rejects non-http(s) URLs', () => {
    expect(isAllowedImportUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedImportUrl('https://example.com')).toBe(true);
  });

  it('rejects snapshots that include cookie or auth payloads', () => {
    const result = sanitizeBrowserMemorySnapshot({
      url: 'https://example.com',
      title: 'Auth page',
      content: '<p>body</p>',
      cookies: { session: 'secret' },
    });
    expect(result).toEqual({ error: 'Rejected field: cookies' });
  });

  it('falls back to textContent when content is empty', () => {
    const result = sanitizeBrowserMemorySnapshot({
      url: 'https://example.com/plain',
      title: 'Plain',
      content: '',
      textContent: 'Readable plain text for search.',
    });
    expect(result).toHaveProperty('snapshot');
    if ('snapshot' in result) {
      expect(result.snapshot.content).toContain('Readable plain text');
    }
  });

  it('fixture content includes terms reachable by library search', () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
      snapshots: Array<Record<string, unknown>>;
    };
    const query = 'queryable';
    const hits = fixture.snapshots.filter((snap) => {
      const parsed = sanitizeBrowserMemorySnapshot(snap);
      if (!('snapshot' in parsed)) return false;
      const haystack = `${parsed.snapshot.title} ${parsed.snapshot.content}`.toLowerCase();
      return haystack.includes(query);
    });
    expect(hits.length).toBeGreaterThan(0);
  });

  it('imports fixture batch via mocked db layer', async () => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
      snapshots: Array<Record<string, unknown>>;
    };
    const { findMemoryByUrl, createMemoryRecord } = await import('../memories-db');

    const result = await importBrowserMemorySnapshots('user-1', fixture.snapshots, {
      extraTags: ['Research'],
    });

    expect(result.imported).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.ids).toHaveLength(2);
    expect(createMemoryRecord).toHaveBeenCalledTimes(2);
    expect(findMemoryByUrl).toHaveBeenCalled();

    const firstCall = vi.mocked(createMemoryRecord).mock.calls[0]?.[0];
    expect(firstCall?.tags).toContain('browser-memory');
    expect(firstCall?.tags).toContain('Research');
    expect(firstCall?.userId).toBe('user-1');

    const secondUrl = vi.mocked(createMemoryRecord).mock.calls[1]?.[0]?.url;
    expect(secondUrl).not.toContain('token=');
  });
});
