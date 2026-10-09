import { describe, expect, it } from 'vitest';
import { isSpaRoute } from './spa-route';

describe('Reader SPA route boundary', () => {
  it.each(['/app', '/privacy', '/library', '/login', '/extension'])(
    'keeps %s on the application shell',
    (pathname) => {
      expect(isSpaRoute(pathname)).toBe(true);
    }
  );

  it.each([
    '/',
    '/faq',
    '/changelog',
    '/developer-portal',
    '/.well-known/mcp.json',
    '/oauth2/authorize',
    '/api',
    '/unknown',
    '/reader/one',
    '/rss',
    '/board',
    '/memory',
    '/sample',
  ])('does not disguise %s as an application route', (pathname) => {
    expect(isSpaRoute(pathname)).toBe(false);
  });
});
