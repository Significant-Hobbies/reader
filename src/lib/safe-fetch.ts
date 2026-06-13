import { validateExternalUrl } from './url-validation';

export interface FetchWithValidatedRedirectsOptions {
  maxRedirects?: number;
  validateUrl?: typeof validateExternalUrl;
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

/**
 * Fetch a URL without blindly trusting server-side redirects.
 *
 * The initial URL and every redirect target are validated before the next
 * request is issued, so a public URL cannot bounce the server into localhost
 * or a private network hop after the first request is accepted.
 */
export async function fetchWithValidatedRedirects(
  startUrl: string | URL,
  init: RequestInit = {},
  options: FetchWithValidatedRedirectsOptions = {}
): Promise<{ response: Response; url: URL }> {
  const validateUrl = options.validateUrl ?? validateExternalUrl;
  const maxRedirects = options.maxRedirects ?? 5;
  const requestInit: RequestInit = { ...init };
  delete (requestInit as { redirect?: RequestRedirect }).redirect;

  let currentUrl = typeof startUrl === 'string' ? new URL(startUrl) : new URL(startUrl.href);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const response = await fetch(currentUrl.href, {
      ...requestInit,
      redirect: 'manual',
    });

    if (!isRedirectStatus(response.status)) {
      return { response, url: currentUrl };
    }

    const location = response.headers.get('location');
    if (!location) {
      throw new Error('Redirect response missing Location header');
    }

    const nextUrl = new URL(location, currentUrl);
    const validation = await validateUrl(nextUrl.href);
    if (!validation.ok) {
      throw new Error(validation.reason);
    }

    currentUrl = validation.url;
  }

  throw new Error('Too many redirects');
}
