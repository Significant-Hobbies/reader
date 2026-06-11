import type { NextRequest } from 'next/server';

import { getAuthenticatedUserId } from '../../../lib/auth-api';
import { fetchWithValidatedRedirects } from '../../../lib/safe-fetch';
import { validateExternalUrl } from '../../../lib/url-validation';

const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Proxy route that fetches a URL server-side and returns the response
 * with X-Frame-Options and CSP frame-ancestors headers stripped,
 * allowing the content to be embedded in an iframe.
 *
 * Rewrites relative URLs in HTML to absolute so assets load correctly.
 */
export async function GET(request: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const targetUrl = request.nextUrl.searchParams.get('url');
  if (!targetUrl) {
    return new Response('Missing url parameter', { status: 400 });
  }

  const validation = await validateExternalUrl(targetUrl);
  if (!validation.ok) {
    return new Response(validation.reason, { status: 400 });
  }
  const parsed = validation.url;

  try {
    const upstream = await fetchWithValidatedRedirects(parsed, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BlogReader/1.0)',
        Accept: 'text/html,application/xhtml+xml,*/*',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!upstream.response.ok) {
      return new Response(`Upstream returned ${upstream.response.status}`, {
        status: 502,
      });
    }

    const contentType = upstream.response.headers.get('content-type') || '';
    const body = await upstream.response.arrayBuffer();
    if (body.byteLength > MAX_RESPONSE_SIZE) {
      return new Response('Response too large', { status: 502 });
    }

    const isHtml = contentType.includes('text/html');

    // Build response headers - pass through content-type, strip frame-blocking headers
    const responseHeaders = new Headers();
    responseHeaders.set('content-type', contentType);
    responseHeaders.set('cache-control', 'private, no-store');

    if (isHtml) {
      let html = new TextDecoder().decode(body);

      // Inject <base> tag so relative URLs resolve against the original site
      const baseTag = `<base href="${parsed.origin}/">`;
      if (html.includes('<head>')) {
        html = html.replace('<head>', `<head>${baseTag}`);
      } else if (html.includes('<head ')) {
        html = html.replace(/<head\s[^>]*>/, `$&${baseTag}`);
      } else if (html.includes('<html')) {
        html = html.replace(/<html[^>]*>/, `$&<head>${baseTag}</head>`);
      } else {
        html = baseTag + html;
      }

      // Sandbox proxied pages: prevent scripts from running in our origin's
      // context and block them from accessing parent frames or cookies.
      responseHeaders.set(
        'Content-Security-Policy',
        "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; frame-ancestors 'self'"
      );
      // Prevent the proxied page from setting cookies on our domain.
      responseHeaders.set('X-Content-Type-Options', 'nosniff');

      return new Response(html, {
        status: 200,
        headers: responseHeaders,
      });
    }

    // Non-HTML (CSS, JS, images) - stream through
    return new Response(body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error('Proxy error:', err);
    return new Response('Proxy fetch failed', { status: 502 });
  }
}
