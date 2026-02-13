import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from '../../../../lib/firebase-admin';
import {
  fetchArticleById,
  normalizeAIChatMessages,
  normalizeNotes,
  sanitizeTitle,
  verifyArticleOwnership,
} from '../../../../lib/articles-service';
import { ArticleStatus } from '../../../../types';
import { getAuthenticatedUserId } from '../../../../lib/auth-api';

const normalizeStatus = (status: unknown): ArticleStatus | null =>
  status === 'read' || status === 'in_progress' ? status : null;

const LOCAL_ONLY_AI_SETTINGS_FIELDS = new Set([
  'provider',
  'model',
  'apiKey',
  'systemPrompt',
  'aiConfig',
]);

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
    const localOnlyField = Object.keys(payload).find((key) =>
      LOCAL_ONLY_AI_SETTINGS_FIELDS.has(key)
    );
    if (localOnlyField) {
      return NextResponse.json(
        {
          error: `${localOnlyField} is local-only and must not be sent to article persistence.`,
        },
        { status: 400 }
      );
    }

    const { notes, aiChat, title, status, projectId } = payload;

    const docRef = db.collection('annotations').doc(id);
    const updateData: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };

    if (notes !== undefined) {
      const normalized = normalizeNotes(notes);
      updateData.notes = normalized;
      updateData.notesCount = normalized.length;
    }

    if (aiChat !== undefined) {
      updateData.aiChat = normalizeAIChatMessages(aiChat);
    }

    if (typeof title === 'string') {
      const trimmedTitle = sanitizeTitle(title);
      if (trimmedTitle.length > 0) {
        updateData.title = trimmedTitle;
      }
    }

    const normalizedStatus = normalizeStatus(status);
    if (normalizedStatus) {
      updateData.status = normalizedStatus;
    }

    if (typeof projectId === 'string' && projectId.trim()) {
      updateData.projectId = projectId.trim();
    }

    await docRef.update(updateData);

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

    const docRef = db.collection('annotations').doc(id);
    await docRef.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting article:', error);
    return NextResponse.json({ error: 'Failed to delete article' }, { status: 500 });
  }
}
