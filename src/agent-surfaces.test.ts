import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const publicPath = (name: string) => resolve(process.cwd(), 'public', name);
const readPublicFile = (name: string) => readFileSync(publicPath(name), 'utf8');

const sitemap = readPublicFile('sitemap.xml');
const catalog = JSON.parse(readPublicFile('api-ai.json')) as {
  url: string;
  llms: string;
  llmsFull: string;
  sitemap: string;
  robots: string;
  surfaces: Array<{ id: string; url: string; md: string }>;
};

const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

describe('public agent surface parity', () => {
  it('keeps the sitemap limited to cataloged HTML pages', () => {
    expect(sitemapUrls.sort()).toEqual(catalog.surfaces.map((surface) => surface.url).sort());

    for (const url of sitemapUrls) {
      const pathname = new URL(url).pathname;
      expect(pathname).not.toMatch(/\.(?:md|txt|json|xml)$/);
      expect(pathname).not.toBe('/api/ai');
    }
  });

  it('keeps one checked-in Markdown mirror for every cataloged HTML page', () => {
    for (const surface of catalog.surfaces) {
      const markdownUrl = new URL(surface.md);
      expect(markdownUrl.origin).toBe(catalog.url);
      expect(markdownUrl.pathname).toMatch(/\.md$/);
      expect(existsSync(publicPath(markdownUrl.pathname.slice(1)))).toBe(true);
    }
  });

  it('advertises machine resources outside the HTML sitemap', () => {
    const discoverySources = [
      readPublicFile('robots.txt'),
      readPublicFile('llms.txt'),
      readPublicFile('api-ai.json'),
    ].join('\n');

    for (const resource of [
      '/llms.txt',
      '/llms-full.txt',
      '/index.md',
      '/api/ai',
      '/robots.txt',
      '/sitemap.xml',
    ]) {
      expect(discoverySources).toContain(resource);
    }
  });
});
