import { del, put } from '@vercel/blob';

// PDFs live in a private Vercel Blob store. Keys are unguessable but we still
// require auth + ownership check before issuing a download — see
// `src/app/api/pdfs/[id]/download/route.ts`. The private-store SDK does not
// expose a server-side "generate short-lived signed URL" primitive; the only
// way to hand bytes to a browser is to stream them through our own route.
const PDF_PREFIX = 'pdfs';

export interface UploadPdfOptions {
  filename: string;
  userId: string;
}

export interface UploadPdfResult {
  /** The blob store pathname / key. Persist this in `pdfStorageKey`. */
  storageKey: string;
  /** Size of the uploaded payload in bytes. */
  sizeBytes: number;
}

function sanitizeFilename(filename: string): string {
  const base = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return base.length > 0 ? base : 'document.pdf';
}

function toBuffer(input: Buffer | ArrayBuffer): Buffer {
  return Buffer.isBuffer(input) ? input : Buffer.from(input);
}

/**
 * Upload a PDF to private Vercel Blob storage. Returns the storage key to
 * persist on the article row. Callers never hand the raw URL to clients —
 * access is always mediated by `getPdfDownloadUrl()`.
 */
export async function uploadPdf(
  buffer: Buffer | ArrayBuffer,
  opts: UploadPdfOptions
): Promise<UploadPdfResult> {
  const body = toBuffer(buffer);
  const sanitized = sanitizeFilename(opts.filename);
  // The random suffix makes keys unguessable even though the store is private.
  const pathname = `${PDF_PREFIX}/${opts.userId}/${sanitized}`;

  const result = await put(pathname, body, {
    access: 'private',
    addRandomSuffix: true,
    contentType: 'application/pdf',
  });

  return {
    storageKey: result.pathname,
    sizeBytes: body.length,
  };
}

/**
 * Return a URL that a browser can use to download the PDF. We always route
 * this through our own proxy (`/api/pdfs/[id]/download`) so that auth +
 * ownership are checked on every request. The `articleId` is the Turso row
 * id, not the storage key.
 */
export function getPdfDownloadUrl(articleId: string): string {
  return `/api/pdfs/${encodeURIComponent(articleId)}/download`;
}

/**
 * Fetch PDF bytes from Vercel Blob. Used by the download proxy route to
 * stream the file to the authenticated user.
 */
export async function fetchPdfBytes(storageKey: string): Promise<{
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  size: number;
}> {
  // Dynamic import keeps the blob client out of bundles that only need
  // `uploadPdf` / `getPdfDownloadUrl`.
  const { get } = await import('@vercel/blob');
  const result = await get(storageKey, { access: 'private' });
  if (!result || result.statusCode !== 200) {
    throw new Error('PDF not found in storage');
  }
  return {
    stream: result.stream,
    contentType: result.blob.contentType,
    size: result.blob.size,
  };
}

/**
 * Delete a PDF from blob storage. Safe to call even if the key no longer
 * exists — `del()` is idempotent.
 */
export async function deletePdf(storageKey: string): Promise<void> {
  await del(storageKey);
}
