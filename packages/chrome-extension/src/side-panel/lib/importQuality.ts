import type { PageContent } from './types';

export interface ImportNotice {
  title: string;
  message: string;
  blocking?: boolean;
}

const RESTRICTED_PROTOCOLS = new Set([
  'about:',
  'chrome:',
  'chrome-extension:',
  'edge:',
  'moz-extension:',
  'safari-extension:',
]);

const APP_PAGE_PATTERN =
  /\/(account|admin|app|auth|billing|dashboard|login|profile|settings|signin|sign-in|workspace)(\/|$)/i;

export function getImportNotice(
  page: PageContent | null,
  usedFallback = false
): ImportNotice | null {
  if (!page) {
    return {
      title: 'This page cannot be imported yet',
      message:
        'Chrome may block extension access on browser pages, PDF viewers, or protected tabs.',
      blocking: true,
    };
  }

  let url: URL | null = null;
  try {
    url = new URL(page.url);
  } catch {
    return {
      title: 'This page may not import cleanly',
      message: 'The page URL is unusual, so the saved article may need manual cleanup.',
      blocking: true,
    };
  }

  if (RESTRICTED_PROTOCOLS.has(url.protocol)) {
    return {
      title: 'This page cannot be imported directly',
      message: 'Chrome blocks extensions from reading browser, extension, and internal pages.',
      blocking: true,
    };
  }

  if (usedFallback) {
    return {
      title: 'This page may need cleanup',
      message: 'Reader could not find article markup and will save visible page text instead.',
    };
  }

  const textLength = (page.textContent || page.content || '').trim().length;
  if (textLength < 500) {
    return {
      title: 'This page looks light on readable content',
      message: 'It may be an app screen, paywalled page, or dynamic page that imports partially.',
    };
  }

  if (APP_PAGE_PATTERN.test(url.pathname)) {
    return {
      title: 'This looks like an authenticated app page',
      message:
        'Reader will save what is visible now, but private app state may not reproduce later.',
    };
  }

  return null;
}

export function canImportPage(page: PageContent | null, usedFallback = false): boolean {
  return getImportNotice(page, usedFallback)?.blocking !== true;
}
