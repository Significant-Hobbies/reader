import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { getAuthenticatedUserId } from '../../../lib/auth-api';
import { fetchWithValidatedRedirects } from '../../../lib/safe-fetch';
import { validateExternalUrl } from '../../../lib/url-validation';

const MAX_RESPONSE_SIZE = 10 * 1024 * 1024; // 10MB

export async function GET(req: NextRequest) {
  const userId = await getAuthenticatedUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const targetUrl = req.nextUrl.searchParams.get('url');

  if (!targetUrl) {
    return new NextResponse('URL parameter is required', { status: 400 });
  }

  const validation = await validateExternalUrl(targetUrl);
  if (!validation.ok) {
    return new NextResponse(validation.reason, { status: 400 });
  }

  try {
    const { response } = await fetchWithValidatedRedirects(validation.url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const body = await response.arrayBuffer();
    if (body.byteLength > MAX_RESPONSE_SIZE) {
      throw new Error('Response too large');
    }

    const html = new TextDecoder().decode(body);
    const { document } = parseHTML(html);

    const reader = new Readability(document);
    const article = reader.parse();

    if (!article) {
      throw new Error('Failed to parse article content');
    }

    return NextResponse.json({
      snapshot: {
        title: article.title ?? '',
        content: article.content ?? '',
        byline: article.byline ?? null,
        siteName: article.siteName ?? null,
        url: targetUrl,
      },
    });
  } catch (error: unknown) {
    console.error('Snapshot error:', error);
    return NextResponse.json(
      { message: 'Failed to capture the website content.' },
      { status: 500 }
    );
  }
}
