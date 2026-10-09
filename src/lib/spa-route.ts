const SPA_ROUTES = new Set(['/app', '/library', '/login', '/extension', '/privacy']);

export function isSpaRoute(pathname: string): boolean {
  return SPA_ROUTES.has(pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname);
}
