export const dynamic = 'force-dynamic';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getAuthenticatedUserId } from '../../../../../lib/auth-api';
import { db } from '../../../../../lib/db/client';
import { articles } from '../../../../../lib/db/schema';
import { fetchPdfBytes } from '../../../../../lib/storage';

// Proxy route: streams PDF bytes from private Vercel Blob storage to an
// authenticated owner. The blob store is private, so the SDK does not expose
// a server-signable short-lived URL — streaming through a same-origin route
// is the cleanest way to enforce auth on every fetch.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const rows = await db
      .select({
        userId: articles.userId,
        pdfStorageKey: articles.pdfStorageKey,
        type: articles.type,
      })
      .from(articles)
      .where(eq(articles.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (row.userId !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (row.type !== 'pdf' || !row.pdfStorageKey) {
      return NextResponse.json({ error: 'Article has no PDF' }, { status: 404 });
    }

    const { stream, contentType, size } = await fetchPdfBytes(row.pdfStorageKey);

    const headers = new Headers();
    headers.set('content-type', contentType || 'application/pdf');
    if (typeof size === 'number') headers.set('content-length', String(size));
    // Short private-cache; do not let intermediaries cache across users.
    headers.set('cache-control', 'private, max-age=3600');

    return new Response(stream, { status: 200, headers });
  } catch (error) {
    console.error('Error streaming PDF:', error);
    return NextResponse.json({ error: 'Failed to load PDF' }, { status: 500 });
  }
}
