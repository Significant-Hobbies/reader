import { NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { db } from '../../../../lib/firebase-admin';
import {
  fetchBoardById,
  verifyBoardOwnership,
  sanitizeNodes,
  sanitizeEdges,
  generateShareId,
  revokeShareId,
} from '../../../../lib/boards-service';
import { sanitizeTitle } from '../../../../lib/articles-service';
import { getAuthenticatedUserId } from '../../../../lib/auth-api';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const board = await fetchBoardById(id, userId);
    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    return NextResponse.json(board);
  } catch (error) {
    console.error('Error fetching board:', error);
    return NextResponse.json({ error: 'Failed to fetch board' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const isOwner = await verifyBoardOwnership(id, userId);
    if (!isOwner) {
      return NextResponse.json({ error: 'Not found or not authorized' }, { status: 404 });
    }

    const body = await request.json();
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;

    if (payload.shareAction === 'generate') {
      const shareId = await generateShareId(id, userId);
      if (!shareId)
        return NextResponse.json({ error: 'Failed to generate share link' }, { status: 500 });
      return NextResponse.json({ shareId });
    }

    if (payload.shareAction === 'revoke') {
      await revokeShareId(id, userId);
      return NextResponse.json({ success: true });
    }

    const docRef = db.collection('boards').doc(id);
    const updateData: Record<string, unknown> = {
      updatedAt: Timestamp.now(),
    };

    if (typeof payload.name === 'string') {
      const trimmedName = sanitizeTitle(payload.name, 'Untitled Board');
      if (trimmedName.length > 0) {
        updateData.name = trimmedName;
      }
    }

    if (payload.nodes !== undefined) {
      updateData.nodes = sanitizeNodes(payload.nodes);
    }

    if (payload.edges !== undefined) {
      updateData.edges = sanitizeEdges(payload.edges);
    }

    await docRef.update(updateData);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating board:', error);
    return NextResponse.json({ error: 'Failed to update board' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const isOwner = await verifyBoardOwnership(id, userId);
    if (!isOwner) {
      return NextResponse.json({ error: 'Not found or not authorized' }, { status: 404 });
    }

    await db.collection('boards').doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting board:', error);
    return NextResponse.json({ error: 'Failed to delete board' }, { status: 500 });
  }
}
