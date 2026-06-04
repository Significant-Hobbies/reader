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

  // Cache-Control for `/` is set in next.config headers() — middleware-set
  // headers were being concatenated with the page handler's emitted
  // s-maxage, producing a doubled Cache-Control. headers() runs at the
  // route-config layer and CF respects the resulting single value.
}

export const config = {
  matcher: '/',
};
