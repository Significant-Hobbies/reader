import { NextResponse } from 'next/server';

import { fetchArticleByShareId } from '../../../../../lib/articles-db';

export async function GET(_request: Request, { params }: { params: Promise<{ shareId: string }> }) {
  try {
    const { shareId } = await params;
    if (!shareId || shareId.length > 30) {
      return NextResponse.json({ error: 'Invalid share link' }, { status: 400 });
    }

    const article = await fetchArticleByShareId(shareId);
    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    return NextResponse.json(article);
  } catch (error) {
    console.error('Error fetching shared article:', error);
    return NextResponse.json({ error: 'Failed to fetch article' }, { status: 500 });
  }
}
