// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ validate: vi.fn(), fetch: vi.fn() }));
vi.mock('../url-validation', () => ({ validateExternalUrl: mocks.validate }));
vi.mock('../safe-fetch', () => ({ fetchWithValidatedRedirects: mocks.fetch }));
import { contentText, fetchLinkContent } from '../link-content';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.validate.mockResolvedValue({ ok: true, url: new URL('https://example.com') });
});
it('extracts stored text without script or style instructions', () => {
  expect(contentText('<p>A fact</p><script>steal()</script><style>hidden</style>')).toBe('A fact');
});
it('rejects private destinations before issuing a fetch', async () => {
  mocks.validate.mockResolvedValue({ ok: false, reason: 'Blocked private IP' });
  await expect(fetchLinkContent('http://localhost')).rejects.toThrow('Blocked private IP');
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it('extracts web text and keeps the request timeout attached to the body stream', async () => {
  const paragraph =
    'A long discussion of SQLite and the situations where a local database fits a product. '.repeat(
      15
    );
  mocks.fetch.mockResolvedValue({
    url: new URL('https://example.com'),
    response: new Response(
      `<html><head><title>SQLite</title></head><body><article><h1>SQLite</h1><p>${paragraph}</p></article></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    ),
  });
  expect(await fetchLinkContent('https://example.com')).toContain('A long discussion');
  expect(mocks.fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
});
it('reads plain text and reports unsupported, empty, oversized, or failed responses', async () => {
  mocks.fetch.mockResolvedValue({
    url: new URL('https://example.com'),
    response: new Response('Some text', { headers: { 'Content-Type': 'text/plain' } }),
  });
  expect(await fetchLinkContent('https://example.com')).toBe('Some text');
  for (const response of [
    new Response('PDF', { headers: { 'Content-Type': 'application/pdf' } }),
    new Response('', { status: 403 }),
    new Response('a'.repeat(2 * 1024 * 1024 + 1), { headers: { 'Content-Type': 'text/plain' } }),
    new Response(null, { headers: { 'Content-Type': 'text/html' } }),
  ]) {
    mocks.fetch.mockResolvedValue({ url: new URL('https://example.com'), response });
    await expect(fetchLinkContent('https://example.com')).rejects.toThrow();
  }
});
