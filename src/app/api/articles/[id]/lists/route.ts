import { NextRequest, NextResponse } from 'next/server';
import { addArticleToList, removeArticleFromList } from '../../../../../lib/lists-service';
import { getAuthenticatedUserId } from '../../../../../lib/auth-api';

/**
 * Add an article to a list
 * POST /api/articles/[id]/lists
 * Body: { listId: string }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: articleId } = await params;
    if (!articleId) {
      return NextResponse.json({ error: 'Article id is required' }, { status: 400 });
    }

    const body = await request.json();
    const { listId } = body || {};

    if (typeof listId !== 'string' || !listId.trim()) {
      return NextResponse.json({ error: 'List id is required' }, { status: 400 });
    }

    await addArticleToList(articleId, listId, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error adding article to list:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
      if (error.message === 'Article not found' || error.message === 'List not found') {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    return NextResponse.json({ error: 'Failed to add article to list' }, { status: 500 });
  }
}

/**
 * Remove an article from a list
 * DELETE /api/articles/[id]/lists?listId=xxx
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: articleId } = await params;
    if (!articleId) {
      return NextResponse.json({ error: 'Article id is required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const listId = searchParams.get('listId');

    if (!listId) {
      return NextResponse.json({ error: 'List id is required' }, { status: 400 });
    }

    await removeArticleFromList(articleId, listId, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing article from list:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
      if (error.message === 'Article not found') {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    return NextResponse.json({ error: 'Failed to remove article from list' }, { status: 500 });
  }
}
