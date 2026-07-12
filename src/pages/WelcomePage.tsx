import { BookOpen, FileText, Highlighter, MessageSquare, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

const features = [
  {
    icon: FileText,
    title: 'One library for everything',
    body: 'Paste a URL, upload a PDF, or save a link. Articles get cleaned into a readable snapshot; everything lives in one place.',
  },
  {
    icon: Highlighter,
    title: 'Read and annotate',
    body: 'A distraction-free typography view with highlights and notes that persist on the exact text you marked.',
  },
  {
    icon: MessageSquare,
    title: 'Chat with your sources',
    body: 'Ask questions of a single article or your whole library. Bring your own AI key — your notes stay yours.',
  },
];

const steps = [
  {
    n: '1',
    title: 'Save a source',
    body: 'Paste a link, drop a PDF, or use the Chrome extension to capture a page in one click.',
  },
  {
    n: '2',
    title: 'Read and highlight',
    body: 'Open it in the reader view, highlight the parts that matter, and jot notes alongside.',
  },
  {
    n: '3',
    title: 'Ask and revisit',
    body: 'Generate an AI summary, chat with the text, and come back to your annotations any time.',
  },
];

export default function WelcomePage() {
  return (
    <div className="min-h-screen bg-[#0d0d0c] text-gray-100">
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-5xl px-6 py-20 text-center md:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-gray-300">
            <BookOpen className="h-3.5 w-3.5" />
            Library Reader
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-balance md:text-5xl">
            Read, annotate, and chat with everything you save.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-gray-400">
            A personal research library. Save articles and PDFs, read them in a clean view with
            highlights, and ask AI questions of your own sources.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/library"
              className="inline-flex h-11 items-center rounded-md bg-[var(--accent-9,#a87c4b)] px-5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              Open your library
            </Link>
            <Link
              to="/sample"
              className="inline-flex h-11 items-center rounded-md border border-white/15 px-5 text-sm font-medium text-gray-200 transition-colors hover:bg-white/5"
            >
              Try a sample doc
            </Link>
            <Link
              to="/extension"
              className="inline-flex h-11 items-center rounded-md border border-white/15 px-5 text-sm font-medium text-gray-200 transition-colors hover:bg-white/5"
            >
              Chrome extension setup
            </Link>
          </div>
          <p className="mt-4 text-xs text-gray-500">
            No account needed to start — your library works locally in this browser. Sign in to sync
            across devices.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/5 text-[var(--accent-11,#c79b6a)]">
                <f.icon className="h-4 w-4" />
              </div>
              <h2 className="mt-4 text-base font-semibold">{f.title}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-white/10">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkles className="h-4 w-4 text-[var(--accent-11,#c79b6a)]" />
            How it works
          </h2>
          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="rounded-xl border border-white/10 p-5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
                  {s.n}
                </div>
                <h3 className="mt-3 text-sm font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-gray-400">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/10">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="text-2xl font-bold tracking-tight">Start your library</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-gray-400">
            Save your first article or PDF — it takes a few seconds and works right in your browser.
          </p>
          <Link
            to="/library"
            className="mt-6 inline-flex h-11 items-center rounded-md bg-[var(--accent-9,#a87c4b)] px-6 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            Open your library
          </Link>
          <p className="mt-6 text-xs text-gray-500">
            <Link to="/about" className="underline underline-offset-2 hover:text-gray-300">
              About
            </Link>{' '}
            ·{' '}
            <Link to="/privacy" className="underline underline-offset-2 hover:text-gray-300">
              Privacy
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
