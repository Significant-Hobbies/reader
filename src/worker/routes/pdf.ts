import { eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { createArticleRecord } from '../../lib/articles-db';
import { getAuthenticatedUserId } from '../../lib/auth-api';
import { db } from '../../lib/db/client';
import { articles } from '../../lib/db/schema';
import { validatePDFFile } from '../../lib/pdf-service';
import { fetchPdfBytes, getPdfDownloadUrl, uploadPdf } from '../../lib/storage';
import type { WorkerEnv } from '../../lib/worker-env';

const pdf = new Hono<{ Bindings: WorkerEnv }>();

pdf.post('/upload', async (c) => {
  try {
    const userId = await getAuthenticatedUserId(c.req.raw.headers, c.env);
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    const projectId = formData.get('projectId') as string | null;

    const listIdsString = formData.get('listIds') as string | null;
    let listIds: string[] = [];
    if (listIdsString) {
      try {
        const parsed = JSON.parse(listIdsString);
        if (Array.isArray(parsed)) {
          listIds = parsed;
        }
      } catch (error) {
        console.error('Failed to parse listIds:', error);
      }
    }

    const category = formData.get('category') as string | null;

    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    const headerBytes = await file.slice(0, 5).arrayBuffer();
    const magic = Buffer.from(headerBytes).toString('ascii');
    if (magic !== '%PDF-') {
      return c.json({ error: 'File must be a PDF' }, 400);
    }

    const validation = validatePDFFile(file);
    if (!validation.valid) {
      return c.json({ error: validation.error }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { storageKey, sizeBytes } = await uploadPdf(buffer, {
      filename: file.name,
      userId,
    });

    const title = file.name.replace(/\.pdf$/i, '') || file.name;
    const urlKey = `blob://${storageKey}`;

    const id = await createArticleRecord({
      url: urlKey,
      title,
      content: `<p>${title}</p>`,
      projectId: projectId || undefined,
      userId,
      type: 'pdf',
      pdfMetadata: {
        fileSize: sizeBytes,
        storagePath: storageKey,
      },
      listIds,
      category: category || undefined,
    });

    return c.json({
      id,
      title,
      pdfUrl: getPdfDownloadUrl(id),
    });
  } catch (error) {
    console.error('Error uploading PDF:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Failed to upload PDF' }, 500);
  }
});

pdf.get('/:id/download', async (c) => {
  try {
    const userId = await getAuthenticatedUserId(c.req.raw.headers, c.env);
    if (!userId) return c.json({ error: 'Unauthorized' }, 401);

    const id = c.req.param('id');
    if (!id) return c.json({ error: 'Missing id' }, 400);

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
    if (!row) return c.json({ error: 'Not found' }, 404);
    if (row.userId !== userId) return c.json({ error: 'Not found' }, 404);
    if (row.type !== 'pdf' || !row.pdfStorageKey) {
      return c.json({ error: 'Article has no PDF' }, 404);
    }

    const { stream, contentType, size } = await fetchPdfBytes(row.pdfStorageKey);

    const headers = new Headers();
    headers.set('content-type', contentType || 'application/pdf');
    if (typeof size === 'number') headers.set('content-length', String(size));
    headers.set('cache-control', 'private, max-age=3600');

    return new Response(stream, { status: 200, headers });
  } catch (error) {
    console.error('Error streaming PDF:', error);
    return c.json({ error: 'Failed to load PDF' }, 500);
  }
});

export default pdf;
