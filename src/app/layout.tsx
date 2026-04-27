import './globals.css';

import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';

import { AuthProvider } from '../components/AuthProvider';
import { QueryProvider } from '../components/QueryProvider';
import { SaaSMakerFeedback } from '../components/saasmaker-feedback';
import { SaasMakerAnalytics } from '../components/SaasMakerAnalytics';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

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
    template: '%s | Web Annotator',
    default: 'Web Annotator | Capture and comment on the web',
  },
  description: 'Turn any web page into a readable snapshot, annotate it, and revisit your notes.',
  keywords: ['web annotation', 'readability', 'research', 'highlights', 'notes', 'firestore'],
  applicationName: 'Web Annotator',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Web Annotator | Capture and comment on the web',
    description:
      'Snapshot web pages into readable copies, add notes, and keep everything in one library.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Web Annotator | Capture and comment on the web',
    description:
      'Snapshot web pages into readable copies, add notes, and keep everything in one library.',
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
        <AuthProvider>
          <QueryProvider>{children}</QueryProvider>
          <SaaSMakerFeedback />
          <SaasMakerAnalytics />
        </AuthProvider>
      </body>
    </html>
  );
}
