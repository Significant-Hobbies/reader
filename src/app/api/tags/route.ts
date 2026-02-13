import { NextResponse } from 'next/server';
import { fetchAllTags } from '../../../lib/articles-service';
import { getAuthenticatedUserId } from '../../../lib/auth-api';

export async function GET() {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tags = await fetchAllTags(userId);
    return NextResponse.json({ tags });
  } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 });
  }
}
