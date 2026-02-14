import { NextRequest, NextResponse } from 'next/server';
import { createArticleRecord, fetchArticleSummaries } from '../../../lib/articles-service';
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
