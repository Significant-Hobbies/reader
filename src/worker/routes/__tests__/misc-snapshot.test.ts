import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ user: vi.fn(), validate: vi.fn(), fetch: vi.fn() }));
vi.mock('../../../lib/auth-api', () => ({ getAuthenticatedUserId: mocks.user }));
vi.mock('../../../lib/db/client', () => ({ db: {}, schema: {} }));
vi.mock('../../../lib/url-validation', () => ({ validateExternalUrl: mocks.validate }));
vi.mock('../../../lib/ai-cloudflare', () => ({ getLanguageModel: vi.fn() }));

import { sanitizeArticlePayload } from '../../../lib/articles-db';
import routes from '../misc';

const app = new Hono().route('/api', routes);
const startUrl = 'https://initial.example/start';
const finalUrl = 'https://source.example/articles/story?edition=1#intro';
const html = `<html><head><title>Synthetic article</title>
  <base href="https://untrusted.example/"></head><body><article><h1>Synthetic article</h1>
  <p>${'This is a synthetic readable article for testing source links. '.repeat(30)}</p>
  <p><a href="/explore/">Explore</a><a href="/insights/">Insights</a>
  <a href="next?edition=2#details">Next</a><a href="?edition=2#details">Edition</a>
  <a href="#intro">Jump</a><img src="../image.png"><img src="//cdn.example/image.png">
  <a href="javascript:alert(1)">Unsafe</a></p></article></body></html>`;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue('synthetic-user');
  mocks.validate.mockImplementation(async (url: string) => ({ ok: true, url: new URL(url) }));
  vi.stubGlobal('fetch', mocks.fetch);
});
afterEach(() => vi.unstubAllGlobals());

describe('snapshot source URL resolution', () => {
  it('resolves extracted links using the validated redirect destination before storage', async () => {
    mocks.fetch
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: finalUrl },
        })
      )
      .mockResolvedValueOnce(new Response(html));
    const response = await app.request(`/api/snapshot?url=${encodeURIComponent(startUrl)}`);
    expect(response.status).toBe(200);
    const { snapshot } = await response.json();
    expect(snapshot.url).toBe(finalUrl);
    expect(mocks.validate).toHaveBeenNthCalledWith(1, startUrl);
    expect(mocks.validate).toHaveBeenNthCalledWith(2, finalUrl);
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(mocks.fetch).toHaveBeenNthCalledWith(
      2,
      finalUrl,
      expect.objectContaining({ redirect: 'manual' })
    );
    for (const url of [
      'https://source.example/explore/',
      'https://source.example/insights/',
      'https://source.example/articles/next?edition=2#details',
      'https://source.example/articles/story?edition=2#details',
      'https://source.example/image.png',
      'https://cdn.example/image.png',
    ]) {
      expect(snapshot.content).toContain(url);
    }
    expect(snapshot.content).toContain('href="#intro"');
    expect(snapshot.content).not.toMatch(/javascript:|untrusted\.example/);
    // Capture callers currently save the initial URL. Absolute extracted links survive that step.
    expect(
      sanitizeArticlePayload({ ...snapshot, url: startUrl, userId: 'synthetic-user' }).content
    ).toBe(snapshot.content);
  });

  it('resolves a non-redirected capture against its full source URL', async () => {
    mocks.fetch.mockResolvedValueOnce(new Response(html));
    const response = await app.request(`/api/snapshot?url=${encodeURIComponent(finalUrl)}`);
    const { snapshot } = await response.json();
    expect(snapshot.url).toBe(finalUrl);
    expect(snapshot.content).toContain('https://source.example/articles/next?edition=2#details');
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects unsafe initial URLs without fetching', async () => {
    mocks.validate.mockResolvedValue({ ok: false, reason: 'Blocked: localhost' });
    const response = await app.request('/api/snapshot?url=http://localhost/private');
    expect(response.status).toBe(400);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('rejects unsafe redirects before fetching the target', async () => {
    mocks.fetch.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: 'http://127.0.0.1/private' },
      })
    );
    mocks.validate
      .mockResolvedValueOnce({ ok: true, url: new URL(startUrl) })
      .mockResolvedValueOnce({ ok: false, reason: 'Blocked: private or reserved IP' });
    const response = await app.request(`/api/snapshot?url=${encodeURIComponent(startUrl)}`);
    expect(response.status).toBe(500);
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
});
