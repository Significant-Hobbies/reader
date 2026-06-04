import { NextResponse } from 'next/server';

import { getAuthenticatedUserId } from '../../../../lib/auth-api';
import type { BrowserMemorySnapshotInput } from '../../../../lib/browser-memory-import';
import { importBrowserMemorySnapshots } from '../../../../lib/browser-memory-import';

const MAX_BATCH_SIZE = 50;

export async function POST(request: Request) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const snapshots = body?.snapshots;
    if (!Array.isArray(snapshots) || snapshots.length === 0) {
      return NextResponse.json({ error: 'snapshots array is required' }, { status: 400 });
    }
    if (snapshots.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `At most ${MAX_BATCH_SIZE} snapshots per request` },
        { status: 400 }
      );
    }

    const listIds = Array.isArray(body.listIds) ? body.listIds : undefined;
    const category = typeof body.category === 'string' ? body.category : undefined;

    const result = await importBrowserMemorySnapshots(
      userId,
      snapshots as BrowserMemorySnapshotInput[],
      { listIds, category }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('browser-memory import error:', error);
    return NextResponse.json({ error: 'Failed to import browser memory' }, { status: 500 });
  }
}
