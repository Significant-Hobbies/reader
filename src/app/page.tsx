import type { Metadata } from 'next';

import { MarketingLanding } from '../components/MarketingLanding';

// Emit s-maxage=3600 on the response so the CF Edge serves cached HTML
// without re-running the Worker. Verified 919ms TTFB on a fully-static
// homepage was Worker cold-start; this makes warm CF Edge hits skip the
// Worker entirely.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Library Reader — save, read, highlight, and listen',
  description:
    'A personal research library for articles and PDFs. Clean typography, persistent highlights, text-to-speech, and AI chat over your own sources. Works in your browser without an account.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Library Reader — save, read, highlight, and listen',
    description:
      'A personal research library for articles and PDFs. Clean typography, persistent highlights, text-to-speech, and AI chat over your own sources.',
    type: 'website',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Library Reader — save, read, highlight, and listen',
    description:
      'A personal research library for articles and PDFs. Clean typography, highlights, text-to-speech, and AI chat over your own sources.',
  },
};

// `/` is intentionally static and free of the auth/DB lookup that used to
// gate <HomeClient />. psi-swarm flagged TTFB ≈ 1.7s on the SSR path —
// dominant LCP contributor. Signed-in users still reach the library via
// the CTA → `/library`, where the auth check is still enforced.
export default function Page() {
  return <MarketingLanding />;
}
