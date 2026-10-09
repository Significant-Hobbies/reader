import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

import { fetchWithValidatedRedirects } from './safe-fetch';
import { validateExternalUrl } from './url-validation';

const MAX_BYTES = 2 * 1024 * 1024;

export function contentText(html: string) {
  const { document } = parseHTML(`<html><body>${html}</body></html>`);
  for (const element of document.querySelectorAll('script, style, noscript')) element.remove();
  return (document.body.textContent ?? '').replace(/\s+/gu, ' ').trim().slice(0, 100_000);
}

export async function fetchLinkContent(url: string) {
  const validation = await validateExternalUrl(url);
  if (!validation.ok) throw new Error(validation.reason);
  const { response, url: finalUrl } = await fetchWithValidatedRedirects(validation.url, {
    headers: { Accept: 'text/html, text/plain;q=0.9' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Source returned HTTP ${response.status}.`);
  const type = response.headers.get('content-type') ?? '';
  if (!/text\/(html|plain)|application\/xhtml\+xml/u.test(type)) {
    await response.body?.cancel();
    throw new Error('This source is not a web page or text document. Open the original link.');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Source returned no content.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error('Source is too large. Open the original link.');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }
  const html = new TextDecoder().decode(buffer);
  if (type.includes('text/plain')) return html.trim().slice(0, 100_000);
  const { document } = parseHTML(html);
  Object.defineProperties(document, {
    baseURI: { value: finalUrl.href },
    documentURI: { value: finalUrl.href },
  });
  const article = new Readability(document).parse();
  const text = article?.textContent?.trim();
  if (!text) throw new Error('Could not extract readable content. Open the original link.');
  return text.slice(0, 100_000);
}
