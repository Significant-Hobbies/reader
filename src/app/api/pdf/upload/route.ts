import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserId } from '../../../../lib/auth-api';
import { extractTextFromPDF, validatePDFFile } from '../../../../lib/pdf-service';
import { createArticleRecord } from '../../../../lib/articles-service';
import { ensureFirebaseAdmin } from '../../../../lib/firebase-admin';
import { getStorage } from 'firebase-admin/storage';

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const projectId = formData.get('projectId') as string | null;

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

    ensureFirebaseAdmin();
    const storage = getStorage();
    const bucket = storage.bucket(
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.appspot.com`
    );

    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storagePath = `pdfs/${userId}/${timestamp}_${sanitizedFileName}`;
    const fileRef = bucket.file(storagePath);

    await fileRef.save(buffer, {
      metadata: {
        contentType: 'application/pdf',
        metadata: {
          userId,
          uploadedAt: new Date().toISOString(),
        },
      },
    });

    await fileRef.makePublic();
    const pdfUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;

    const title = extraction.metadata?.title || file.name.replace('.pdf', '');
    const byline = extraction.metadata?.author;

    const id = await createArticleRecord({
      url: pdfUrl,
      title,
      byline: byline || undefined,
      content: extraction.text,
      projectId: projectId || undefined,
      userId,
      type: 'pdf',
      pdfUrl,
      extractedText: extraction.text,
      pdfMetadata: {
        pageCount: extraction.pageCount,
        fileSize: buffer.length,
      },
    });

    return NextResponse.json({
      id,
      title,
      pageCount: extraction.pageCount,
      pdfUrl,
    });
  } catch (error) {
    console.error('Error uploading PDF:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload PDF' },
      { status: 500 }
    );
  }
}
