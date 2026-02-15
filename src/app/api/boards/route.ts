import { NextResponse } from 'next/server';
import { fetchBoardSummaries, createBoard } from '../../../lib/boards-service';
import { getAuthenticatedUserId } from '../../../lib/auth-api';

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const boards = await fetchBoardSummaries(userId);
    return NextResponse.json(boards);
  } catch (error) {
    console.error('Error fetching boards:', error);
    return NextResponse.json({ error: 'Failed to fetch boards' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name } = body || {};

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Board name is required' }, { status: 400 });
    }

    const id = await createBoard(name, userId);
    return NextResponse.json({ id });
  } catch (error) {
    console.error('Error creating board:', error);
    return NextResponse.json({ error: 'Failed to create board' }, { status: 500 });
  }
}
