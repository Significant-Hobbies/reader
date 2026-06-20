import { BookOpen, ChevronRight, FileText, Headphones, Highlighter, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Public landing page rendered at `/` for signed-out visitors.
 *
 * Honest copy only — no fabricated testimonials, ratings, or social proof.
 * Every claim here is backed by a real feature in the codebase:
 * - "Save articles and PDFs" → ArticleSummary type, PDFReaderClient, R2 storage
 * - "Highlights + notes that anchor to text" → ReaderView annotations
 * - "Listen" → TTSPlayer (Web Speech API) in article + PDF readers + extension
 * - "AI chat with your sources" → NotesAIChat (BYOK providers)
 * - "Works in your browser without an account" → local-library.ts fallback
 */

const features = [
  {
    icon: FileText,
    title: 'One library for articles and PDFs',
    body: 'Paste a URL and the page is cleaned with Mozilla Readability. Upload a PDF and it goes into the same library, with text extraction for search and chat.',
  },
  {
    icon: Highlighter,
    title: 'Highlight and annotate',
    body: 'A distraction-free reader view with persistent highlights and a side panel for notes. Annotations anchor to the exact text you marked so they survive across visits.',
  },
  {
    icon: Headphones,
    title: 'Listen to anything you save',
    body: 'Hit Listen on an article or PDF and your browser reads it aloud — voice and rate are controllable. The same control is available from the Chrome extension.',
  },
];

const steps = [
  {
    n: '1',
    title: 'Save a source',
    body: 'Paste a link, drop a PDF, or use the Chrome extension to capture the current page in one click.',
  },
  {
    n: '2',
    title: 'Read, highlight, listen',
    body: 'Open it in the reader view. Highlight what matters, add notes in the side panel, or play it back as audio.',
  },
  {
    n: '3',
    title: 'Ask and revisit',
    body: 'Generate a summary, chat with the text using your own AI key, and come back to your highlights any time.',
  },
];

const faqs = [
  {
    q: 'Do I need an account to try it?',
    a: 'No. The library works in your browser without signing in — articles, PDFs, highlights, and notes are stored locally. Sign in with Google when you want to sync across devices.',
  },
  {
    q: 'Where are my PDFs stored?',
    a: 'For signed-in users, PDFs are uploaded to Cloudflare R2 and accessed through a proxy that enforces ownership. In local mode, the PDF stays in your browser.',
  },
  {
    q: 'How does the AI chat work? Whose API key does it use?',
    a: 'You bring your own key — OpenAI, Anthropic, or Gemini — and it is stored in your browser. There is also a gateway option and a local-AI mode for development. We never proxy your key through a server.',
  },
  {
    q: 'What does the Chrome extension do?',
    a: 'It captures the page you are on (cleaned via Readability) and saves it to your library. It also exposes the Listen control, so you can have any page read aloud without leaving it.',
  },
  {
    q: 'Can I export my data?',
    a: 'Yes. The About page has an Export button that downloads every article, board, and list scoped to your account as a single JSON file.',
  },
];

export function MarketingLanding() {
  return (
    <div className="min-h-screen bg-[#0d0d0c] text-gray-100">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0d0d0c]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/5 text-sm font-semibold text-[var(--accent-11,#c79b6a)]">
              L
            </span>
            <span className="text-sm font-semibold tracking-tight text-gray-100">
              Library Reader
            </span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-gray-400 md:flex">
            <a href="#features" className="hover:text-gray-100">
              Features
            </a>
            <a href="#how" className="hover:text-gray-100">
              How it works
            </a>
            <a href="#faq" className="hover:text-gray-100">
              FAQ
            </a>
            <Link to="/extension" className="hover:text-gray-100">
              Extension
            </Link>
          </nav>
          <Link
            to="/login"
            className="inline-flex h-9 items-center rounded-md bg-[var(--accent-9,#a87c4b)] px-4 text-xs font-semibold text-black transition-opacity hover:opacity-90"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-5xl px-6 py-20 text-center md:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-gray-300">
            <BookOpen className="h-3.5 w-3.5" />
            Personal research library
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-balance md:text-5xl">
            Save it, read it, highlight it, listen to it.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-gray-400">
            One library for the articles and PDFs you actually want to read. Clean typography,
            persistent highlights, text-to-speech, and AI chat over your own sources.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/library"
              className="inline-flex h-11 items-center rounded-md bg-[var(--accent-9,#a87c4b)] px-5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
            >
              Save your first article
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
          <p className="mt-4 text-xs text-gray-500">
            No account needed — works in your browser right now.{' '}
            <Link to="/extension" className="underline underline-offset-2 hover:text-gray-300">
              Chrome extension available.
            </Link>
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-5xl px-6 py-16">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">What it actually does</h2>
          <p className="mt-3 text-sm leading-6 text-gray-400">
            Three things, kept deliberately small. No feed, no recommendations, no inbox.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/5 text-[var(--accent-11,#c79b6a)]">
                <f.icon className="h-4 w-4" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-6 text-gray-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Demo / screenshot block */}
      <section id="demo" className="border-t border-white/10">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className="max-w-2xl">
            <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
              <Sparkles className="h-5 w-5 text-[var(--accent-11,#c79b6a)]" />
              The reader view
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-400">
              Articles get cleaned into a typography-first layout. Select any text to add a note or
              send it to AI. Press the Listen button to have the page read aloud.
            </p>
          </div>

          {/* Placeholder screenshot block — no fabricated image. Renders a
              representative reader layout with neutral, non-claim text. */}
          <div className="mt-8 overflow-hidden rounded-xl border border-white/10 bg-[#0a0908] shadow-[0_10px_60px_rgba(0,0,0,0.4)]">
            <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.02] px-4 py-2">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              </div>
              <div className="text-[11px] text-gray-500">library / reader</div>
              <div className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-gray-300">
                <Headphones className="h-3 w-3" />
                Listen
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-[1fr_240px]">
              <div className="px-8 py-10 md:px-12 md:py-14">
                <div className="text-[11px] tracking-widest text-gray-500 uppercase">Article</div>
                <div className="mt-2 h-6 w-3/4 rounded bg-white/10" />
                <div className="mt-3 h-3 w-1/2 rounded bg-white/5" />
                <div className="mt-8 space-y-3">
                  <div className="h-3 w-full rounded bg-white/5" />
                  <div className="h-3 w-[97%] rounded bg-white/5" />
                  <div className="h-3 w-[94%] rounded bg-white/5" />
                  <div className="h-3 w-[60%] rounded bg-[var(--accent-9,#a87c4b)]/40" />
                  <div className="h-3 w-[88%] rounded bg-white/5" />
                  <div className="h-3 w-[92%] rounded bg-white/5" />
                  <div className="h-3 w-[40%] rounded bg-white/5" />
                </div>
              </div>
              <aside className="border-t border-white/10 bg-white/[0.015] p-5 md:border-t-0 md:border-l">
                <div className="text-[11px] tracking-widest text-gray-500 uppercase">Notes</div>
                <div className="mt-3 space-y-3">
                  <div className="rounded-md border border-white/10 p-3">
                    <div className="h-2.5 w-3/4 rounded bg-white/15" />
                    <div className="mt-2 h-2 w-full rounded bg-white/5" />
                    <div className="mt-1.5 h-2 w-[80%] rounded bg-white/5" />
                  </div>
                  <div className="rounded-md border border-white/10 p-3">
                    <div className="h-2.5 w-1/2 rounded bg-white/15" />
                    <div className="mt-2 h-2 w-full rounded bg-white/5" />
                  </div>
                </div>
              </aside>
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] text-gray-500">
            Layout sketch — your library renders your real content.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-white/10">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">How it works</h2>
            <p className="mt-3 text-sm leading-6 text-gray-400">
              Three steps from a URL to a library you keep coming back to.
            </p>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
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

      {/* FAQ */}
      <section id="faq" className="border-t border-white/10">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">FAQ</h2>
          <div className="mt-8 divide-y divide-white/10 rounded-xl border border-white/10">
            {faqs.map((f) => (
              <details
                key={f.q}
                className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-medium text-gray-100">
                  {f.q}
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-500 transition-transform group-open:rotate-90" />
                </summary>
                <p className="mt-3 text-sm leading-6 text-gray-400">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Single CTA */}
      <section className="border-t border-white/10">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Start your library</h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-gray-400">
            Save your first article or PDF. It works in your browser right now — sign in later if
            you want to sync.
          </p>
          <Link
            to="/library"
            className="mt-7 inline-flex h-11 items-center rounded-md bg-[var(--accent-9,#a87c4b)] px-6 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          >
            Save your first article
            <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
          <p className="mt-6 text-xs text-gray-500">
            <Link to="/about" className="underline underline-offset-2 hover:text-gray-300">
              About
            </Link>{' '}
            ·{' '}
            <Link to="/privacy" className="underline underline-offset-2 hover:text-gray-300">
              Privacy
            </Link>{' '}
            ·{' '}
            <Link to="/extension" className="underline underline-offset-2 hover:text-gray-300">
              Chrome extension
            </Link>
          </p>
        </div>
      </section>

      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto max-w-5xl px-6 text-center text-xs text-gray-500">
          Your reading list is not the same as your understanding. Library Reader helps with the
          gap.
        </div>
      </footer>
    </div>
  );
}
