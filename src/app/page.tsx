import type { Metadata } from 'next';

import HomeClient from '../components/HomeClient';
import { MarketingLanding } from '../components/MarketingLanding';
import { getCurrentUser } from '../lib/auth-server';

export const dynamic = 'force-dynamic';

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

export default async function Page() {
  // Signed-in users go straight to the library (HomeClient).
  // Anonymous visitors see the marketing landing. They can still try the
  // local-mode library by clicking the CTA, which routes to /library.
  const user = await getCurrentUser();
  if (user) {
    return <HomeClient />;
  }
  return <MarketingLanding />;
}
