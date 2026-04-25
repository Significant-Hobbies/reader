import { NextResponse } from 'next/server';
import {
  deleteBoard,
  fetchBoardById,
  generateShareId,
  revokeShareId,
  updateBoard,
  verifyBoardOwnership,
} from '../../../../lib/boards-db';
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

    await updateBoard(id, userId, payload);
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

    await deleteBoard(id, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting board:', error);
    return NextResponse.json({ error: 'Failed to delete board' }, { status: 500 });
  }
}
