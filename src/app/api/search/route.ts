import { NextRequest, NextResponse } from 'next/server';
import { searchArticles } from '../../../lib/articles-service';
import { getAuthenticatedUserId } from '../../../lib/auth-api';

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const query = request.nextUrl.searchParams.get('q') || '';
    const projectId = request.nextUrl.searchParams.get('projectId') || undefined;

    if (!query || query.trim().length < 2) {
      return NextResponse.json({ results: [] });
    }

    const results = await searchArticles(userId, query, projectId);
    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error searching articles:', error);
    return NextResponse.json({ error: 'Failed to search articles' }, { status: 500 });
  }
}
