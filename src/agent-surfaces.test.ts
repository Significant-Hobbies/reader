import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AGENT_SURFACE } from './agent-edge.mjs';

const readPublic = (path: string) => readFileSync(resolve(process.cwd(), 'public', path), 'utf8');

function sitemapUrls(): string[] {
  return [...readPublic('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (match) => match[1] ?? ''
  );
}

describe('public agent surface parity', () => {
  it('keeps the sitemap limited to canonical HTML surfaces', () => {
    const catalogUrls = AGENT_SURFACE.catalog.surfaces.map((surface) => surface.url);
    const urls = sitemapUrls();

    expect(urls).toEqual(catalogUrls);
    expect(urls).toHaveLength(4);
    for (const url of urls) {
      const path = new URL(url).pathname;
      expect(path).not.toMatch(/\.(?:json|md|txt|xml)$/);
      expect(path).not.toMatch(/^\/api(?:\/|$)/);
    }
  });

  it('provides a substantive Markdown counterpart for every HTML surface', () => {
    const publicOrigin = new URL(AGENT_SURFACE.url).origin;

    for (const surface of AGENT_SURFACE.catalog.surfaces) {
      expect(surface.md).toBeTruthy();
      const markdownUrl = new URL(surface.md ?? '');
      expect(markdownUrl.origin).toBe(publicOrigin);
      const markdown = readPublic(markdownUrl.pathname.replace(/^\//, ''));
      expect(markdown).toMatch(/^#\s+\S/m);
      expect(markdown.trim().length).toBeGreaterThan(120);
    }
  });

  it('keeps machine resources discoverable but outside the HTML sitemap', () => {
    const urls = new Set(sitemapUrls());
    const robots = readPublic('robots.txt');
    const llms = readPublic('llms.txt');
    const catalog = AGENT_SURFACE.catalog;
    const machineResources = [
      catalog.llms,
      catalog.llmsFull,
      catalog.sitemap,
      catalog.robots,
      `${AGENT_SURFACE.url}/api/ai`,
      `${AGENT_SURFACE.url}/index.md`,
    ];

    for (const resource of machineResources) {
      expect(urls).not.toContain(resource);
    }
    expect(robots).toContain(`Sitemap: ${catalog.sitemap}`);
    expect(robots).toContain('Allow: /llms.txt');
    expect(robots).toContain('Allow: /llms-full.txt');
    expect(robots).toContain('Allow: /index.md');
    expect(robots).toContain('Allow: /api/ai');
    expect(llms).toContain(catalog.sitemap);
    expect(llms).toContain(catalog.llmsFull);
    expect(llms).toContain('/api/ai');
    expect(AGENT_SURFACE.llmsTxt).toBe(llms);
    expect(AGENT_SURFACE.llmsFullTxt).toBe(readPublic('llms-full.txt'));
    expect(AGENT_SURFACE.catalog.surfaces).toEqual(JSON.parse(readPublic('api-ai.json')).surfaces);
  });
});
