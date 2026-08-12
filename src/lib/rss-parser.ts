import { DOMParser } from 'linkedom';
import sanitizeHtml from 'sanitize-html';

const MAX_OPML_BYTES = 1_000_000;
export const MAX_FEED_BYTES = 2_000_000;
const MAX_OPML_FEEDS = 500;
const MAX_FEED_ENTRIES = 200;
const DOM_PARSER = new DOMParser();

export interface OpmlSubscription {
  title: string;
  feedUrl: string;
  siteUrl?: string;
}

export interface NormalizedFeedEntry {
  externalId: string;
  url?: string;
  title: string;
  author?: string;
  content?: string;
  excerpt?: string;
  publishedAt?: Date;
}

export interface ParsedFeed {
  title?: string;
  siteUrl?: string;
  entries: NormalizedFeedEntry[];
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function cleanText(value: string | null | undefined, maxLength = 2_000): string {
  const sanitized = sanitizeHtml(value ?? '', { allowedTags: [], allowedAttributes: {} });
  return textFromSanitizedHtml(sanitized, maxLength);
}

function textFromSanitizedHtml(value: string, maxLength: number): string {
  const document = DOM_PARSER.parseFromString(`<html><body>${value}</body></html>`, 'text/html');
  return (document.body.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeText(value: string | null | undefined, maxLength = 2_000): string {
  const text = value ?? '';
  if (text.includes('<')) return cleanText(text, maxLength);
  return text.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function cleanHtml(value: string | null | undefined): string | undefined {
  const cleaned = sanitizeHtml(value ?? '', {
    allowedTags: sanitizeHtml.defaults.allowedTags,
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: [...(sanitizeHtml.defaults.allowedAttributes.a ?? []), 'rel'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
  }).trim();
  return cleaned || undefined;
}

function firstText(element: Element, names: string[]): string {
  for (const name of names) {
    const node = element.getElementsByTagName(name)[0];
    const value = normalizeText(node?.textContent);
    if (value) return value;
  }
  return '';
}

function firstRawText(element: Element, names: string[]): string {
  for (const name of names) {
    const node = element.getElementsByTagName(name)[0];
    const value = node?.textContent?.trim();
    if (value) return value;
  }
  return '';
}

function parseDate(value: string): Date | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp) : undefined;
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createEntryExternalId(parts: {
  id?: string;
  url?: string;
  title: string;
  publishedAt?: Date;
}): string {
  const rawId = parts.id ?? '';
  const explicitId =
    rawId.includes('<') || rawId.includes('&')
      ? cleanText(rawId, 1_000)
      : rawId.replace(/\s+/g, ' ').trim().slice(0, 1_000);
  if (explicitId) return explicitId;
  const identity = [parts.url ?? '', parts.title, parts.publishedAt?.toISOString() ?? ''].join('|');
  return `generated:${stableHash(identity)}`;
}

function parseXml(xml: string) {
  const document = DOM_PARSER.parseFromString(xml, 'text/xml');
  if (!document?.documentElement) throw new Error('Malformed XML document');
  return document;
}

function normalizeHttpUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const parsed = new URL(value.trim());
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

export function parseOpml(xml: string): OpmlSubscription[] {
  if (!xml.trim() || byteLength(xml) > MAX_OPML_BYTES) {
    throw new Error(byteLength(xml) > MAX_OPML_BYTES ? 'OPML file is too large' : 'OPML is empty');
  }
  if (!/<opml[\s>]/i.test(xml)) throw new Error('Invalid OPML document');

  const document = parseXml(xml);
  if (document.documentElement.localName.toLowerCase() !== 'opml') {
    throw new Error('Invalid OPML document');
  }

  const subscriptions: OpmlSubscription[] = [];
  const seen = new Set<string>();
  for (const outline of Array.from(document.getElementsByTagName('outline'))) {
    const feedUrl = normalizeHttpUrl(outline.getAttribute('xmlUrl'));
    if (!feedUrl || seen.has(feedUrl)) continue;
    seen.add(feedUrl);
    subscriptions.push({
      title: normalizeText(
        outline.getAttribute('title') || outline.getAttribute('text') || new URL(feedUrl).hostname,
        500
      ),
      feedUrl,
      siteUrl: normalizeHttpUrl(outline.getAttribute('htmlUrl')),
    });
    if (subscriptions.length >= MAX_OPML_FEEDS) break;
  }

  if (subscriptions.length === 0) throw new Error('OPML contains no valid feeds');
  return subscriptions;
}

function getAtomLink(element: Element): string | undefined {
  const links = Array.from(element.getElementsByTagName('link'));
  const alternate = links.find((link) => {
    const rel = link.getAttribute('rel');
    return !rel || rel === 'alternate';
  });
  return normalizeHttpUrl(alternate?.getAttribute('href') || alternate?.textContent);
}

function normalizeEntry(element: Element, atom: boolean): NormalizedFeedEntry | null {
  const title = firstText(element, ['title']) || 'Untitled entry';
  const url = atom ? getAtomLink(element) : normalizeHttpUrl(firstRawText(element, ['link']));
  const author = atom
    ? firstText(element, ['name', 'author'])
    : firstText(element, ['dc:creator', 'creator', 'author']);
  const rawContent = firstRawText(
    element,
    atom ? ['content', 'summary'] : ['content:encoded', 'description']
  );
  const content = cleanHtml(rawContent);
  const excerpt = content ? textFromSanitizedHtml(content, 500) || undefined : undefined;
  const publishedAt = parseDate(
    firstRawText(element, atom ? ['published', 'updated'] : ['pubDate', 'dc:date', 'date'])
  );
  const id = firstRawText(element, atom ? ['id'] : ['guid']);

  return {
    externalId: createEntryExternalId({ id, url, title, publishedAt }),
    url,
    title,
    author: author || undefined,
    content,
    excerpt,
    publishedAt,
  };
}

export function parseFeed(xml: string): ParsedFeed {
  if (!xml.trim() || byteLength(xml) > MAX_FEED_BYTES) {
    throw new Error(
      byteLength(xml) > MAX_FEED_BYTES ? 'Feed response is too large' : 'Feed is empty'
    );
  }

  const document = parseXml(xml);
  const rootName = document.documentElement.localName.toLowerCase();
  const atom = rootName === 'feed';
  const channel = atom ? document.documentElement : document.getElementsByTagName('channel')[0];
  if (!atom && !channel) throw new Error('Unsupported RSS or Atom feed');

  const entryElements = Array.from(document.getElementsByTagName(atom ? 'entry' : 'item')).slice(
    0,
    MAX_FEED_ENTRIES
  );
  if (entryElements.length === 0) throw new Error('Feed contains no entries');

  const entries = entryElements
    .map((entry) => normalizeEntry(entry, atom))
    .filter((entry): entry is NormalizedFeedEntry => Boolean(entry));

  return {
    title: firstText(channel, ['title']) || undefined,
    siteUrl: atom ? getAtomLink(channel) : normalizeHttpUrl(firstRawText(channel, ['link'])),
    entries,
  };
}
