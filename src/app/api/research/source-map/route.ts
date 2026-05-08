import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { fetchArticlesForSourceMap } from '../../../../lib/articles-db';
import { getAuthenticatedUserId } from '../../../../lib/auth-api';
import { buildSourceRelationshipMap } from '../../../../lib/research-brief';

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const focusId = request.nextUrl.searchParams.get('focusId') || undefined;
    const articles = await fetchArticlesForSourceMap(userId);
    return NextResponse.json(buildSourceRelationshipMap(articles, focusId));
  } catch (error) {
    console.error('Error building source map:', error);
    return NextResponse.json({ error: 'Failed to build source map' }, { status: 500 });
  }
}
