import {
  createArticleRecord,
  findArticleByUrl,
  normalizeTags,
  sanitizeArticlePayload,
  sanitizePlainText,
  sanitizeTitle,
} from './articles-db';

/** Shape produced by the Chrome extension content script (Readability). */
export interface BrowserMemorySnapshotInput {
  url?: unknown;
  title?: unknown;
  byline?: unknown;
  content?: unknown;
  textContent?: unknown;
  siteName?: unknown;
  visitedAt?: unknown;
  // Rejected if present — import must not store auth/session payloads
  cookies?: unknown;
  headers?: unknown;
  localStorage?: unknown;
  sessionStorage?: unknown;
  credentials?: unknown;
  authorization?: unknown;
}

export interface SanitizedBrowserMemorySnapshot {
  url: string;
  title: string;
  byline: string;
  content: string;
  siteName: string;
}

export interface BrowserMemoryImportResult {
  imported: number;
  skipped: number;
  failed: number;
  ids: string[];
  errors: { url: string; reason: string }[];
}

const BROWSER_MEMORY_TAG = 'browser-memory';

const SENSITIVE_QUERY_PARAMS = new Set([
  'token',
  'access_token',
  'auth',
  'session',
  'api_key',
  'apikey',
  'password',
  'secret',
  'credential',
  'credentials',
  'set-cookie',
]);

const REJECTED_SNAPSHOT_KEYS = new Set([
  'cookies',
  'headers',
  'localStorage',
  'sessionStorage',
  'credentials',
  'authorization',
]);

function hasRejectedPayloadFields(input: BrowserMemorySnapshotInput): string | null {
  for (const key of REJECTED_SNAPSHOT_KEYS) {
    if (key in input && input[key as keyof BrowserMemorySnapshotInput] != null) {
      return `Rejected field: ${key}`;
    }
  }
  return null;
}

/** Strip auth-like query params from URLs before storage. */
export function stripSensitiveUrlParams(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    for (const param of [...parsed.searchParams.keys()]) {
      if (SENSITIVE_QUERY_PARAMS.has(param.toLowerCase())) {
        parsed.searchParams.delete(param);
      }
    }
    return parsed.href;
  } catch {
    return rawUrl;
  }
}

export function isAllowedImportUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Normalize and sanitize one extension snapshot. Returns null if unusable.
 * Does not persist cookies, headers, or storage dumps.
 */
export function sanitizeBrowserMemorySnapshot(
  input: BrowserMemorySnapshotInput
): { snapshot: SanitizedBrowserMemorySnapshot } | { error: string } {
  const rejected = hasRejectedPayloadFields(input);
  if (rejected) return { error: rejected };

  const rawUrl = sanitizePlainText(input.url);
  if (!rawUrl) return { error: 'URL is required' };

  const url = stripSensitiveUrlParams(rawUrl);
  if (!isAllowedImportUrl(url)) return { error: 'Invalid URL scheme' };

  const content = String(input.content ?? '').trim();
  const textFallback = sanitizePlainText(input.textContent);
  const resolvedContent = content || textFallback;
  if (!resolvedContent) return { error: 'Content is required' };

  try {
    const sanitized = sanitizeArticlePayload({
      url,
      title: sanitizeTitle(input.title, url),
      byline: sanitizePlainText(input.byline ?? ''),
      content: resolvedContent,
      userId: 'sanitize-only',
      tags: [BROWSER_MEMORY_TAG],
      type: 'article',
    });

    return {
      snapshot: {
        url: sanitized.url,
        title: sanitized.title,
        byline: sanitized.byline,
        content: sanitized.content,
        siteName: sanitizePlainText(input.siteName ?? '').slice(0, 200),
      },
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Sanitization failed' };
  }
}

export async function importBrowserMemorySnapshots(
  userId: string,
  snapshots: BrowserMemorySnapshotInput[],
  options?: { listIds?: string[]; category?: string; extraTags?: string[] }
): Promise<BrowserMemoryImportResult> {
  const result: BrowserMemoryImportResult = {
    imported: 0,
    skipped: 0,
    failed: 0,
    ids: [],
    errors: [],
  };

  const listIds = options?.listIds?.filter((id) => typeof id === 'string' && id.trim()) ?? [];
  const category = options?.category?.trim()
    ? sanitizePlainText(options.category).slice(0, 50)
    : undefined;
  const extraTags = normalizeTags(options?.extraTags ?? []);
  const tags = normalizeTags([BROWSER_MEMORY_TAG, ...extraTags]);

  for (const raw of snapshots) {
    const parsed = sanitizeBrowserMemorySnapshot(raw);
    if ('error' in parsed) {
      result.failed += 1;
      result.errors.push({
        url: sanitizePlainText(raw.url) || '(unknown)',
        reason: parsed.error,
      });
      continue;
    }

    const { snapshot } = parsed;
    const existingId = await findArticleByUrl(snapshot.url, userId);
    if (existingId) {
      result.skipped += 1;
      result.ids.push(existingId);
      continue;
    }

    try {
      const id = await createArticleRecord({
        url: snapshot.url,
        title: snapshot.title,
        byline: snapshot.byline,
        content: snapshot.content,
        userId,
        type: 'article',
        listIds,
        category,
        tags,
      });
      result.imported += 1;
      result.ids.push(id);
    } catch (err) {
      result.failed += 1;
      result.errors.push({
        url: snapshot.url,
        reason: err instanceof Error ? err.message : 'Import failed',
      });
    }
  }

  return result;
}
