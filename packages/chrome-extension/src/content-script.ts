import { Readability } from '@mozilla/readability';

interface ExtractionResult {
  title: string;
  byline: string | null;
  content: string;
  textContent: string;
  siteName: string | null;
  url: string;
  canImport?: boolean;
}

interface ExtractionResponse {
  type: 'PAGE_CONTENT';
  data: ExtractionResult | null;
  fallback: boolean;
}

function extractWithReadability(): ExtractionResult | null {
  try {
    const clone = document.cloneNode(true) as Document;
    const article = new Readability(clone).parse();
    if (!article) return null;

    return {
      title: article.title || document.title,
      byline: article.byline || null,
      content: article.content || '',
      textContent: article.textContent || '',
      siteName: article.siteName || null,
      url: location.href,
    };
  } catch {
    return null;
  }
}

function extractFallback(): ExtractionResult {
  return {
    title: document.title,
    byline: null,
    content: document.body?.innerText?.slice(0, 8000) || '',
    textContent: document.body?.innerText?.slice(0, 8000) || '',
    siteName: null,
    url: location.href,
  };
}

chrome.runtime.onMessage.addListener(
  (
    message: { type: string },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtractionResponse) => void
  ) => {
    if (message.type === 'GET_PAGE_CONTENT') {
      const article = extractWithReadability();
      if (article) {
        sendResponse({ type: 'PAGE_CONTENT', data: article, fallback: false });
      } else {
        sendResponse({
          type: 'PAGE_CONTENT',
          data: extractFallback(),
          fallback: true,
        });
      }
    }
    return true;
  }
);
