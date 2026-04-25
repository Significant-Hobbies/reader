export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '../../../../lib/auth-api';
import { extractTextFromPDF, validatePDFFile } from '../../../../lib/pdf-service';
import { createArticleRecord } from '../../../../lib/articles-db';
import { getPdfDownloadUrl, uploadPdf } from '../../../../lib/storage';

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string | null;

    // Get listIds from FormData (sent as JSON string)
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

    // Get category from FormData
    const category = formData.get('category') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
    }

    const validation = validatePDFFile(file);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const extraction = await extractTextFromPDF(buffer);

    const { storageKey, sizeBytes } = await uploadPdf(buffer, {
      filename: file.name,
      userId,
    });

    const title = extraction.metadata?.title || file.name.replace(/\.pdf$/i, '');
    const byline = extraction.metadata?.author;

    // Store the blob key as the article's `url` so lookups / dedup don't clash
    // with the private blob URL — the actual download URL is generated on read.
    const urlKey = `blob://${storageKey}`;

    const id = await createArticleRecord({
      url: urlKey,
      title,
      byline: byline || undefined,
      content: extraction.text,
      projectId: projectId || undefined,
      userId,
      type: 'pdf',
      extractedText: extraction.text,
      pdfMetadata: {
        pageCount: extraction.pageCount,
        fileSize: sizeBytes,
        storagePath: storageKey,
      },
      listIds,
      category: category || undefined,
    });

    return NextResponse.json({
      id,
      title,
      pageCount: extraction.pageCount,
      pdfUrl: getPdfDownloadUrl(id),
    });
  } catch (error) {
    console.error('Error uploading PDF:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload PDF' },
      { status: 500 }
    );
  }
}
