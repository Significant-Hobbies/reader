import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Edge-side cookie check that preserves the original `/` → `/library`
 * redirect for signed-in users without forcing the homepage to render
 * dynamically. The full session is still validated by /library on arrival;
 * this is purely a routing hint based on cookie presence.
 *
 * Why: psi-swarm flagged TTFB ≈ 1.7s on the SSR path that called
 * getCurrentUser() inside `page.tsx`. By moving the redirect to middleware
 * and rendering MarketingLanding statically, anon visitors get an instant
 * static response and signed-in users still get auto-routed to the library.
 */
export function middleware(req: NextRequest) {
  const hasSession =
    req.cookies.has('better-auth.session_token') ||
    req.cookies.has('__Secure-better-auth.session_token');

  if (hasSession && req.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/library', req.url));
  }

  // CF Edge was returning cf-cache-status: DYNAMIC on the static homepage
  // because OpenNext emits s-maxage but no max-age. Adding the browser
  // max-age via a Cache-Control override flips CF to actually cache HTML.
  if (req.nextUrl.pathname === '/' && !hasSession) {
    const res = NextResponse.next();
    res.headers.set(
      'Cache-Control',
      'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
    );
    res.headers.set('CDN-Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    return res;
  }
}

export const config = {
  matcher: '/',
};
