import Link from "next/link";

import { ExportDataButton } from "../../components/ExportDataButton";

export const metadata = {
  title: "About — Web Annotator",
  description:
    "Capture, read, annotate articles and PDFs. Chat with your library. Save webpages from a Chrome extension or paste-and-go.",
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 text-sm leading-7">
      <Link href="/" className="text-xs text-stone-500 hover:underline">
        ← Web Annotator
      </Link>
      <h1 className="mt-3 text-3xl font-bold tracking-tight">About</h1>
      <p className="mt-4">
        Web Annotator is a personal research library. Paste any URL or upload a
        PDF; the article body gets cleaned, indexed, and made annotatable. A
        Chrome extension does the same with one click from any page.
      </p>

      <h2 className="mt-8 text-base font-semibold">What you can do</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Save articles and PDFs to a unified library.</li>
        <li>Read in a clean typography view with persistent highlights.</li>
        <li>Chat with one article or the whole library — bring your own AI key, or use the local-AI bridge in dev.</li>
        <li>Drag articles onto a board view (<Link href="/board" className="underline">/board</Link>) to cluster a research project visually.</li>
        <li>Share specific articles via a public share URL.</li>
      </ul>

      <h2 className="mt-8 text-base font-semibold">Stack</h2>
      <p className="mt-2 text-stone-600">
        Next.js 16 + React 19, Turso (libSQL) + Drizzle, better-auth (Google),
        Cloudflare R2 for PDF storage, Vercel AI SDK for chat. Chrome MV3
        extension builds independently in <code>packages/chrome-extension/</code>.
      </p>

      <h2 className="mt-8 text-base font-semibold">Privacy</h2>
      <p className="mt-2 text-stone-600">
        Your library is private by default. Public share URLs are opt-in.
        Chat queries are sent only to the AI provider you configure. See{" "}
        <Link href="/privacy" className="underline">/privacy</Link>.
      </p>

      <h2 className="mt-8 text-base font-semibold">Your data</h2>
      <p className="mt-2 text-stone-600">
        Download every article, board, and list scoped to your account as one
        JSON file. PDF blobs aren&rsquo;t embedded &mdash; only their storage
        keys &mdash; so the file stays small. API keys and auth records are
        excluded.
      </p>
      <ExportDataButton />
    </main>
  );
}
