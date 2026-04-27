import { NextResponse } from 'next/server';

import {
  ArticleUpdateValidationError,
  deleteArticle,
  fetchArticleById,
  generateArticleShareId,
  revokeArticleShareId,
  updateArticle,
  verifyArticleOwnership,
} from '../../../../lib/articles-db';
import { getAuthenticatedUserId } from '../../../../lib/auth-api';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const article = await fetchArticleById(id, userId);
    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    return NextResponse.json(article);
  } catch (error) {
    console.error('Error fetching article:', error);
    return NextResponse.json({ error: 'Failed to fetch article' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const isOwner = await verifyArticleOwnership(id, userId);
    if (!isOwner) {
      return NextResponse.json({ error: 'Not found or not authorized' }, { status: 404 });
    }

    const body = await request.json();
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;

    if (payload.shareAction === 'generate') {
      const shareId = await generateArticleShareId(id, userId);
      if (!shareId)
        return NextResponse.json({ error: 'Failed to generate share link' }, { status: 500 });
      return NextResponse.json({ shareId });
    }

    if (payload.shareAction === 'revoke') {
      await revokeArticleShareId(id, userId);
      return NextResponse.json({ success: true });
    }

    try {
      await updateArticle(id, userId, payload);
    } catch (error) {
      if (error instanceof ArticleUpdateValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating article:', error);
    return NextResponse.json({ error: 'Failed to update article' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const isOwner = await verifyArticleOwnership(id, userId);
    if (!isOwner) {
      return NextResponse.json({ error: 'Not found or not authorized' }, { status: 404 });
    }

    await deleteArticle(id, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting article:', error);
    return NextResponse.json({ error: 'Failed to delete article' }, { status: 500 });
  }
}
