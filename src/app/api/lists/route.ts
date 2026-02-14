import { NextRequest, NextResponse } from 'next/server';
import { createList, fetchLists } from '../../../lib/lists-service';
import { getAuthenticatedUserId } from '../../../lib/auth-api';

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const lists = await fetchLists(userId);
    return NextResponse.json(lists);
  } catch (error) {
    console.error('Error fetching lists:', error);
    return NextResponse.json({ error: 'Failed to fetch lists' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, color } = body || {};

    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'List name is required' }, { status: 400 });
    }

    const id = await createList(name, userId, color);
    return NextResponse.json({ id });
  } catch (error) {
    console.error('Error creating list:', error);
    return NextResponse.json({ error: 'Failed to create list' }, { status: 500 });
  }
}
