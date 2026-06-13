import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchWithValidatedRedirects } from '../safe-fetch';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fetchWithValidatedRedirects', () => {
  it('follows redirects only after validating each hop', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          status: 302,
          headers: { location: 'https://example.com/final' },
        })
      )
      .mockResolvedValueOnce(
        new Response('ok', {
          status: 200,
          headers: { 'content-type': 'text/plain' },
        })
      );

    vi.stubGlobal('fetch', fetchMock);

    const validateUrl = vi.fn(async (url: string) => ({
      ok: true as const,
      url: new URL(url),
    }));

    const result = await fetchWithValidatedRedirects(
      'https://example.com/start',
      {},
      {
        validateUrl,
      }
    );

    expect(result.url.href).toBe('https://example.com/final');
    expect(await result.response.text()).toBe('ok');
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://example.com/start',
      expect.objectContaining({ redirect: 'manual' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://example.com/final',
      expect.objectContaining({ redirect: 'manual' })
    );
  });

  it('rejects redirect targets that fail validation', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: 'http://127.0.0.1/private' },
      })
    );

    vi.stubGlobal('fetch', fetchMock);

    const validateUrl = vi.fn(async () => ({
      ok: false as const,
      reason: 'Blocked: private or reserved IP',
    }));

    await expect(
      fetchWithValidatedRedirects('https://example.com/start', {}, { validateUrl })
    ).rejects.toThrow('Blocked: private or reserved IP');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
