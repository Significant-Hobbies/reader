import { NextRequest, NextResponse } from 'next/server';
import { deleteList, updateList } from '../../../../lib/lists-service';
import { getAuthenticatedUserId } from '../../../../lib/auth-api';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'List id is required' }, { status: 400 });
    }

    await deleteList(id, userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting list:', error);

    // Return specific error messages for known errors
    if (error instanceof Error) {
      if (error.message === 'Cannot delete default lists') {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    return NextResponse.json({ error: 'Failed to delete list' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'List id is required' }, { status: 400 });
    }

    const body = await request.json();
    const { name, color } = body || {};

    const updates: { name?: string; color?: string } = {};
    if (name !== undefined) updates.name = name;
    if (color !== undefined) updates.color = color;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    await updateList(id, userId, updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating list:', error);

    // Return specific error messages for known errors
    if (error instanceof Error) {
      if (error.message === 'Cannot edit default lists') {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
      if (error.message === 'List name is required') {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json({ error: 'Failed to update list' }, { status: 500 });
  }
}
