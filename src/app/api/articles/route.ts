import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  createArticleRecord,
  fetchArticleSummaries,
  findArticleByUrl,
} from '../../../lib/articles-db';
import { getAuthenticatedUserId } from '../../../lib/auth-api';

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const projectId = request.nextUrl.searchParams.get('projectId') || undefined;
    const listId = request.nextUrl.searchParams.get('listId') || undefined;
    const articles = await fetchArticleSummaries(userId, projectId, listId);
    return NextResponse.json(articles);
  } catch (error) {
    console.error('Error fetching articles:', error);
    return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { url, title, byline, content, projectId, tags, listIds, category } = body || {};

    if (!url || !content) {
      return NextResponse.json({ error: 'URL and content are required' }, { status: 400 });
    }

    // Validate URL scheme — reject javascript:, file:, data: etc. that could
    // be stored and later rendered as a clickable link or iframe src.
    // blob:// is a synthetic internal scheme used for PDFs — allow it.
    if (typeof url === 'string' && !url.startsWith('blob://')) {
      try {
        const { protocol } = new URL(url);
        if (!['http:', 'https:'].includes(protocol)) {
          return NextResponse.json({ error: 'Invalid URL scheme' }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
      }
    }

    // Dedup: reuse existing article for this URL if one exists
    const existingId = await findArticleByUrl(url, userId);
    if (existingId) {
      return NextResponse.json({ id: existingId, existing: true });
    }

    const id = await createArticleRecord({
      url,
      title,
      byline,
      content,
      projectId,
      tags,
      userId,
      listIds,
      category,
    });
    return NextResponse.json({ id });
  } catch (error) {
    console.error('Error creating article:', error);
    return NextResponse.json({ error: 'Failed to create article' }, { status: 500 });
  }
}
