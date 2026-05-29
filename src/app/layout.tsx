import '@radix-ui/themes/styles.css';
import './globals.css';

import { Theme } from '@radix-ui/themes';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import { AuthProvider } from '../components/AuthProvider';
import { AnalyticsProvider } from '../components/posthog-provider';
import { QueryProvider } from '../components/QueryProvider';
import { SaaSMakerFeedback } from '../components/saasmaker-feedback';
import { SaasMakerAnalytics } from '../components/SaasMakerAnalytics';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    template: '%s | Library Reader',
    default: 'Library Reader — save, read, highlight, and listen',
  },
  description:
    'A personal research library for articles and PDFs. Clean typography, persistent highlights, text-to-speech, and AI chat over your own sources.',
  keywords: [
    'reader',
    'web annotation',
    'pdf annotation',
    'readability',
    'highlights',
    'notes',
    'text to speech',
    'research library',
  ],
  applicationName: 'Library Reader',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Library Reader — save, read, highlight, and listen',
    description:
      'A personal research library for articles and PDFs. Clean typography, persistent highlights, text-to-speech, and AI chat over your own sources.',
    type: 'website',
    siteName: 'Library Reader',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Library Reader — save, read, highlight, and listen',
    description:
      'A personal research library for articles and PDFs. Clean typography, highlights, text-to-speech, and AI chat over your own sources.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Theme appearance="dark" accentColor="bronze" grayColor="sand" radius="small" scaling="95%">
          <AnalyticsProvider>
            <AuthProvider>
              <QueryProvider>{children}</QueryProvider>
              <SaaSMakerFeedback />
              <SaasMakerAnalytics />
            </AuthProvider>
          </AnalyticsProvider>
        </Theme>
      </body>
    </html>
  );
}
