import { NextResponse } from 'next/server';

import { fetchBoardByShareId } from '../../../../lib/boards-db';

export async function GET(_request: Request, { params }: { params: Promise<{ shareId: string }> }) {
  try {
    const { shareId } = await params;
    // base64url(16 bytes) = exactly 22 chars; reject anything outside that to
    // block probing with malformed or over-long tokens.
    if (!shareId || !/^[A-Za-z0-9_-]{22}$/.test(shareId)) {
      return NextResponse.json({ error: 'Invalid share link' }, { status: 400 });
    }

    const board = await fetchBoardByShareId(shareId);
    if (!board) {
      return NextResponse.json({ error: 'Board not found' }, { status: 404 });
    }

    return NextResponse.json(board);
  } catch (error) {
    console.error('Error fetching shared board:', error);
    return NextResponse.json({ error: 'Failed to fetch board' }, { status: 500 });
  }
}
