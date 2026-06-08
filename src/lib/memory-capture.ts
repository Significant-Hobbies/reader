export type MemoryCaptureKind = 'web_page' | 'blog_article' | 'pdf_document';

export interface MemoryAnnotation {
  id: number;
  text: string;
  quote?: string;
}

export interface MemoryCaptureInput {
  id: string;
  kind: MemoryCaptureKind;
  url: string;
  title: string;
  content?: string;
  extractedText?: string;
  blogOriginUrl?: string;
  siteName?: string;
  capturedAt: string;
  annotations?: MemoryAnnotation[];
  tags?: string[];
}

export interface MemoryCapture {
  id: string;
  kind: MemoryCaptureKind;
  url: string;
  title: string;
  body: string;
  blogOriginUrl?: string;
  siteName?: string;
  capturedAt: string;
  annotations: MemoryAnnotation[];
  tags: string[];
}

export interface MemorySearchHit {
  captureId: string;
  title: string;
  source: {
    kind: MemoryCaptureKind;
    url: string;
    label: string;
  };
  capturedAt: string;
  snippet: string;
  matchedFields: string[];
  annotationContext?: string;
  relevanceScore: number;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function sourceLabel(capture: MemoryCapture): string {
  if (capture.kind === 'pdf_document' && capture.blogOriginUrl) {
    return `PDF export · ${capture.blogOriginUrl}`;
  }
  if (capture.siteName) return `${capture.kind} · ${capture.siteName}`;
  return capture.kind.replace('_', ' ');
}

function getSnippet(text: string, query: string, maxLength = 160): string {
  const lowerText = text.toLowerCase();
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 0);
  let bestIndex = -1;
  for (const term of terms) {
    const index = lowerText.indexOf(term);
    if (index !== -1) {
      bestIndex = index;
      break;
    }
  }
  if (bestIndex === -1) {
    return text.slice(0, maxLength) + (text.length > maxLength ? '…' : '');
  }
  const start = Math.max(0, bestIndex - 40);
  const end = Math.min(text.length, bestIndex + maxLength);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return prefix + text.slice(start, end) + suffix;
}

function matchesQuery(haystack: string, query: string): boolean {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  if (terms.length === 0) return false;
  const lower = haystack.toLowerCase();
  return terms.every((term) => lower.includes(term));
}

function scoreMatch(
  query: string,
  title: string,
  body: string,
  annotations: MemoryAnnotation[]
): number {
  const lowerQuery = query.toLowerCase();
  let score = 0;
  if (title.toLowerCase().includes(lowerQuery)) score += 10;
  if (body.toLowerCase().includes(lowerQuery)) score += 5;
  for (const note of annotations) {
    if (
      note.text.toLowerCase().includes(lowerQuery) ||
      (note.quote?.toLowerCase().includes(lowerQuery) ?? false)
    ) {
      score += 8;
    }
  }
  return score;
}

export function normalizeMemoryCapture(input: MemoryCaptureInput): MemoryCapture | null {
  const body =
    input.kind === 'pdf_document'
      ? (input.extractedText ?? stripHtml(input.content ?? '')).trim()
      : stripHtml(input.content ?? input.extractedText ?? '').trim();

  if (!input.id?.trim() || !input.url?.trim() || !input.title?.trim() || !body) {
    return null;
  }

  return {
    id: input.id.trim(),
    kind: input.kind,
    url: input.url.trim(),
    title: input.title.trim(),
    body,
    blogOriginUrl: input.blogOriginUrl?.trim() || undefined,
    siteName: input.siteName?.trim() || undefined,
    capturedAt: input.capturedAt,
    annotations: input.annotations ?? [],
    tags: input.tags ?? [],
  };
}

export function searchMemoryCaptures(corpus: MemoryCapture[], query: string): MemorySearchHit[] {
  const sanitized = query.trim();
  if (sanitized.length < 2) return [];

  const hits: MemorySearchHit[] = [];

  for (const capture of corpus) {
    const annotationText = capture.annotations.map((a) => `${a.text} ${a.quote ?? ''}`).join(' ');
    const haystack = `${capture.title} ${capture.body} ${annotationText} ${capture.url}`;
    if (!matchesQuery(haystack, sanitized)) continue;

    const matchedFields: string[] = [];
    let snippet = '';
    let annotationContext: string | undefined;

    if (capture.title.toLowerCase().includes(sanitized.toLowerCase())) {
      matchedFields.push('title');
      snippet = capture.title;
    }

    if (capture.body.toLowerCase().includes(sanitized.toLowerCase())) {
      matchedFields.push('content');
      snippet = getSnippet(capture.body, sanitized);
    }

    const matchingNote = capture.annotations.find(
      (a) =>
        a.text.toLowerCase().includes(sanitized.toLowerCase()) ||
        (a.quote?.toLowerCase().includes(sanitized.toLowerCase()) ?? false)
    );
    if (matchingNote) {
      matchedFields.push('annotations');
      annotationContext = matchingNote.quote
        ? `"${matchingNote.quote}" — ${matchingNote.text}`
        : matchingNote.text;
      if (!snippet) snippet = getSnippet(matchingNote.text, sanitized, 120);
    }

    if (!snippet) snippet = getSnippet(capture.body || capture.title, sanitized);

    hits.push({
      captureId: capture.id,
      title: capture.title,
      source: {
        kind: capture.kind,
        url: capture.url,
        label: sourceLabel(capture),
      },
      capturedAt: capture.capturedAt,
      snippet,
      matchedFields,
      annotationContext,
      relevanceScore: scoreMatch(sanitized, capture.title, capture.body, capture.annotations),
    });
  }

  return hits.sort((a, b) => b.relevanceScore - a.relevanceScore);
}
