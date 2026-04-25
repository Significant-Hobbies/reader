import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const R2_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET = process.env.R2_BUCKET_NAME || 'reader-pdfs';

const PDF_PREFIX = 'pdfs';

function getS3Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
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
 * Upload a PDF to Cloudflare R2. Returns the storage key to persist on the
 * article row. Access is mediated by `getPdfDownloadUrl()` — callers never
 * hand the raw signed URL to clients directly.
 */
export async function uploadPdf(
  buffer: Buffer | ArrayBuffer,
  opts: UploadPdfOptions
): Promise<UploadPdfResult> {
  const body = toBuffer(buffer);
  const sanitized = sanitizeFilename(opts.filename);
  const storageKey = `${PDF_PREFIX}/${opts.userId}/${Date.now()}-${sanitized}`;

  const s3 = getS3Client();
  await s3.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: storageKey,
      Body: body,
      ContentType: 'application/pdf',
    })
  );

  return { storageKey, sizeBytes: body.length };
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
 * Fetch PDF bytes from R2 via a presigned URL. Used by the download proxy
 * route to stream the file to the authenticated user.
 */
export async function fetchPdfBytes(storageKey: string): Promise<{
  stream: ReadableStream<Uint8Array>;
  contentType: string;
  size: number;
}> {
  const s3 = getS3Client();
  const signedUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: R2_BUCKET, Key: storageKey }),
    { expiresIn: 3600 }
  );

  const response = await fetch(signedUrl);
  if (!response.ok || !response.body) {
    throw new Error('PDF not found in storage');
  }

  const contentLength = response.headers.get('content-length');
  return {
    stream: response.body,
    contentType: response.headers.get('content-type') || 'application/pdf',
    size: contentLength ? parseInt(contentLength, 10) : 0,
  };
}

/**
 * Delete a PDF from R2. Safe to call even if the key no longer exists —
 * DeleteObjectCommand is idempotent.
 */
export async function deletePdf(storageKey: string): Promise<void> {
  const s3 = getS3Client();
  await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: storageKey }));
}
