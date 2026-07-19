const PDF_PREFIX = 'pdfs';

interface R2HttpMetadata {
  contentType?: string;
}
interface R2Object {
  body: ReadableStream<Uint8Array> | null;
  size: number;
  httpMetadata?: R2HttpMetadata;
}
interface R2BucketLike {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | Uint8Array | string,
    options?: { httpMetadata?: R2HttpMetadata }
  ): Promise<unknown>;
  get(key: string): Promise<R2Object | null>;
  delete(key: string): Promise<void>;
}

let pdfsBucket: R2BucketLike | undefined;

export function setPdfBucket(bucket: R2BucketLike) {
  pdfsBucket = bucket;
}

function getBucket(): R2BucketLike {
  if (!pdfsBucket) {
    throw new Error('R2 binding PDFS_BUCKET is not configured');
  }
  return pdfsBucket;
}

export interface UploadPdfOptions {
  filename: string;
  userId: string;
}

export interface UploadPdfResult {
  /** The R2 object key. Persist this in `pdfStorageKey`. */
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
 * Upload a PDF to Cloudflare R2 via the native binding. Returns the storage
 * key to persist on the article row. Access is mediated by
 * `getPdfDownloadUrl()` — callers never hand the raw URL to clients directly.
 */
export async function uploadPdf(
  buffer: Buffer | ArrayBuffer,
  opts: UploadPdfOptions
): Promise<UploadPdfResult> {
  const body = toBuffer(buffer);
  const sanitized = sanitizeFilename(opts.filename);
  const storageKey = `${PDF_PREFIX}/${opts.userId}/${Date.now()}-${sanitized}`;

  await getBucket().put(storageKey, body, {
    httpMetadata: { contentType: 'application/pdf' },
  });

  return { storageKey, sizeBytes: body.length };
}

/**
 * Return a URL that a browser can use to download the PDF. We always route
 * this through our own proxy (`/api/pdfs/[id]/download`) so that auth +
 * ownership are checked on every request. The `articleId` is the row id.
 */
export function getPdfDownloadUrl(articleId: string): string {
  return `/api/pdfs/${encodeURIComponent(articleId)}/download`;
}

/**
 * Fetch PDF bytes from R2 via the native binding. Used by the download proxy
 * route to stream the file to the authenticated user.
 */
export async function fetchPdfBytes(storageKey: string): Promise<{
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  size: number;
}> {
  const object = await getBucket().get(storageKey);
  if (!object || !object.body) {
    throw new Error('PDF not found in storage');
  }

  return {
    stream: object.body,
    contentType: object.httpMetadata?.contentType || 'application/pdf',
    size: object.size ?? 0,
  };
}
