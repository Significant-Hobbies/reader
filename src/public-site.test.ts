import { describe, expect, it } from 'vitest';
import { handleAgentEdge } from './agent-edge.mjs';
import { publicPages, publicRoutes, publicRobots } from './public-site.mjs';
import copy from './public-copy.json';
import worker from './worker';
import type { WorkerEnv } from './lib/worker-env';

const origin = 'https://read.significanthobbies.com';
const env = {
  ASSETS: {
    fetch: async () => {
      throw new Error('Public source renderer must not fetch user or asset data');
    },
  },
};
describe('public Reader representations', () => {
  it('dispatches discovery through the actual Worker before private API routes', async () => {
    const response = await worker.fetch(
      new Request(`${origin}/api/md/_catalog`),
      env as unknown as WorkerEnv,
      { waitUntil() {}, passThroughOnException() {} } as ExecutionContext
    );
    expect(response.status).toBe(200);
    expect((await response.json()).map((route: { path: string }) => route.path)).toEqual([
      '/',
      '/faq',
      '/changelog',
      '/privacy',
    ]);
  });
  it('serves source-identical pages in all forms without account inputs', async () => {
    for (const route of publicRoutes) {
      for (const [path, accept] of [
        [new URL(route.md).pathname, '*/*'],
        [`/api/md${route.path}`, '*/*'],
        [route.path, 'text/markdown'],
      ]) {
        const response = await handleAgentEdge(
          new Request(`${origin}${path}?private=do-not-export`, {
            headers: {
              accept,
              cookie: 'session_token=do-not-export',
              authorization: 'Bearer do-not-export',
            },
          }),
          env
        );
        expect(response?.status).toBe(200);
        expect(await response?.text()).toBe(publicPages[route.path]);
        expect(response?.headers.get('Content-Location')).toBe(route.url);
        expect(response?.headers.get('X-Markdown-Tokens')).toBe(
          String(Math.ceil(publicPages[route.path].length / 4))
        );
        expect(response?.headers.get('X-Robots-Tag')).toBe('noindex, follow');
      }
    }
    for (const paragraph of copy.privacy.paragraphs)
      expect(publicPages['/privacy']).toContain(paragraph);
  });
  it('preserves HTML preferences and excludes private and unknown paths', async () => {
    for (const accept of [
      '*/*',
      'text/markdown;q=0',
      'text/markdown,text/html',
      'text/markdown;q=0.1,text/html;q=1',
    ]) {
      expect(await handleAgentEdge(new Request(origin, { headers: { accept } }), env)).toBeNull();
    }
    for (const path of [
      '/library.md',
      '/login.md',
      '/api/md/library',
      '/api/md/login',
      '/api/md/api/links',
      '/missing.md',
    ]) {
      expect((await handleAgentEdge(new Request(origin + path), env))?.status).toBe(404);
    }
  });
  it('returns bodyless HEAD and CORS preflight', async () => {
    for (const route of publicRoutes) {
      const get = await handleAgentEdge(new Request(route.md), env);
      const head = await handleAgentEdge(new Request(route.md, { method: 'HEAD' }), env);
      expect(await head?.text()).toBe('');
      expect(head?.headers.get('X-Markdown-Tokens')).toBe(get?.headers.get('X-Markdown-Tokens'));
      const options = await handleAgentEdge(new Request(route.md, { method: 'OPTIONS' }), env);
      expect(options?.status).toBe(204);
      expect(options?.headers.get('Access-Control-Allow-Origin')).toBe('*');
    }
  });
});

it('keeps unknown canonical origins local and declares public machine endpoint exceptions', async () => {
  for (const path of ['/api/md//evil.example/x', '//evil.example/x.md']) {
    const response = await handleAgentEdge(new Request(origin + path));
    expect(response?.status).toBe(404);
    expect(new URL(response!.headers.get('Content-Location')!).origin).toBe(origin);
    expect(response?.headers.get('Link')).toContain(`<${origin}/`);
  }
  const response = await handleAgentEdge(new Request(`${origin}/ai.txt`));
  expect(await response?.text()).toContain('public-machine-endpoints: /api/ai, /api/md/*');
});

it('keeps private robots exclusions segment-bounded and privacy aliases canonical', async () => {
  expect(publicRobots).toContain('Disallow: /app$');
  expect(publicRobots).toContain('Disallow: /app/');
  expect(publicRobots).toContain('Disallow: /library?');
  expect(publicRobots).not.toMatch(/^Disallow: \/(?:app|api)$/m);
  const shell =
    '<html><head><title>Reader</title><meta name="description" content="Home"></head><body>Privacy</body></html>';
  const assets = {
    ASSETS: {
      fetch: async () => new Response(shell, { headers: { 'Content-Type': 'text/html' } }),
    },
  };
  for (const path of ['/privacy', '/privacy/']) {
    const response = await worker.fetch(
      new Request(origin + path),
      assets as unknown as WorkerEnv,
      { waitUntil() {}, passThroughOnException() {} } as ExecutionContext
    );
    const body = await response.text();
    expect(response.headers.get('Link')).toContain('/privacy.md');
    expect(body).toContain(`name="description" content="${copy.privacy.description}"`);
    expect(body).toContain(`rel="canonical" href="${origin}/privacy"`);
  }
});
