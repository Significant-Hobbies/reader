import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getAuthenticatedUserId } from '../../../lib/auth-api';
import { db, schema } from '../../../lib/db/client';

export const dynamic = 'force-dynamic';

const EXPORT_VERSION = 1;

/**
 * GET /api/data-export — dump every row in this account's articles,
 * boards, and lists tables as one JSON file. Auth tables, api keys,
 * and verification tokens are intentionally excluded (those are
 * credentials, not user data). PDF blobs are not embedded — only the
 * R2 storage key is included so users can re-fetch them via the
 * normal /api/pdfs/[id]/download flow.
 */
export async function GET(): Promise<Response> {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [articles, boards, lists] = await Promise.all([
      db.select().from(schema.articles).where(eq(schema.articles.userId, userId)),
      db.select().from(schema.boards).where(eq(schema.boards.userId, userId)),
      db.select().from(schema.lists).where(eq(schema.lists.userId, userId)),
    ]);

    const exportedAt = new Date().toISOString();
    const payload = {
      format: 'reader-export',
      formatVersion: EXPORT_VERSION,
      exportedAt,
      userId,
      counts: {
        articles: articles.length,
        boards: boards.length,
        lists: lists.length,
      },
      tables: {
        articles,
        boards,
        lists,
      },
    };

    const filename = `reader-${exportedAt.slice(0, 10)}.json`;
    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error exporting data:', error);
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 },
    );
  }
}
