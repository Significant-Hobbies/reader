import { NextRequest } from 'next/server';
import { getAuthenticatedUserId } from '../../../lib/auth-api';

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

  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return new Response('Invalid URL', { status: 400 });
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return new Response('Only HTTP(S) URLs allowed', { status: 400 });
  }

  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BlogReader/1.0)',
        Accept: 'text/html,application/xhtml+xml,*/*',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });

    if (!upstream.ok) {
      return new Response(`Upstream returned ${upstream.status}`, {
        status: 502,
      });
    }

    const contentType = upstream.headers.get('content-type') || '';
    const contentLength = upstream.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
      return new Response('Response too large', { status: 502 });
    }

    const isHtml = contentType.includes('text/html');

    // Build response headers - pass through content-type, strip frame-blocking headers
    const responseHeaders = new Headers();
    responseHeaders.set('content-type', contentType);
    responseHeaders.set('cache-control', 'public, max-age=300'); // 5min cache

    if (isHtml) {
      let html = await upstream.text();

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

      return new Response(html, {
        status: 200,
        headers: responseHeaders,
      });
    }

    // Non-HTML (CSS, JS, images) - stream through
    return new Response(upstream.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy fetch failed';
    console.error('Proxy error:', message);
    return new Response(message, { status: 502 });
  }
}
