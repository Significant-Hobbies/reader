import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Sample doc — Reader',
  description: 'See how Reader lets you read, highlight, and annotate any article.',
};

const highlights: { id: number; text: string; note?: string }[] = [
  {
    id: 1,
    text: 'When you explain it simply, you find the gaps.',
    note: 'This is the whole point of the Feynman technique.',
  },
  {
    id: 2,
    text: 'Spaced repetition beats cramming every time.',
  },
  {
    id: 3,
    text: 'Sleep consolidates what you practiced during the day.',
    note: 'Reminder: stop studying past midnight.',
  },
];

export default function SamplePage() {
  return (
    <div className="min-h-screen bg-[#0d0d0c] text-[var(--gray-12)]">
      {/* top bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--gray-4)] bg-[#0d0d0c]/90 px-4 py-3 backdrop-blur-sm">
        <Link
          href="/"
          className="text-sm text-[var(--gray-11)] underline-offset-2 hover:text-[var(--gray-12)] hover:underline"
        >
          ← Back to library
        </Link>
        <div className="flex items-center gap-4 text-sm text-[var(--gray-10)]">
          <span>3 highlights</span>
          <span>·</span>
          <span>2 notes</span>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 py-12">
        {/* article header */}
        <p className="mb-2 text-xs font-medium tracking-widest text-[var(--accent-11)] uppercase">
          Sample article · 4 min read
        </p>
        <h1 className="mb-4 text-3xl leading-tight font-bold text-[var(--gray-12)]">
          How to Learn Anything Fast
        </h1>
        <p className="mb-10 text-sm text-[var(--gray-10)]">Richard Feynman · classic essay</p>

        {/* article body */}
        <div className="prose prose-invert max-w-none space-y-5 text-base leading-8 text-[var(--gray-11)]">
          <p>
            Most people think learning means reading something once and hoping it sticks. It
            doesn&apos;t. Real learning is active. You have to wrestle with ideas, not just receive
            them.
          </p>

          <p>
            The best way to learn is to teach. When you try to explain a concept in plain words, you
            quickly discover what you actually understand versus what you only think you understand.{' '}
            <mark className="not-prose rounded-sm bg-[var(--accent-4)] px-0.5 text-[var(--gray-12)]">
              When you explain it simply, you find the gaps.
            </mark>{' '}
            That&apos;s when real understanding kicks in — go back, fill the gaps, then explain it
            again.
          </p>

          <p>
            Practice beats passive review. Retrieval practice — testing yourself on material instead
            of re-reading it — produces stronger, longer-lasting memories. It feels harder, and
            that&apos;s exactly why it works.{' '}
            <mark className="not-prose rounded-sm bg-[var(--accent-4)] px-0.5 text-[var(--gray-12)]">
              Spaced repetition beats cramming every time.
            </mark>{' '}
            Small daily sessions outperform one marathon before the test.
          </p>

          <p>
            Rest is not optional. Your brain consolidates learning during sleep by replaying and
            strengthening neural patterns from the day.{' '}
            <mark className="not-prose rounded-sm bg-[var(--accent-4)] px-0.5 text-[var(--gray-12)]">
              Sleep consolidates what you practiced during the day.
            </mark>{' '}
            Cutting sleep to study more is a bad trade.
          </p>

          <p>
            Start with the big picture. Before diving into details, scan the structure: headings,
            summary, first and last paragraphs. This gives your brain a scaffold to hang new facts
            on, so they stick instead of sliding off.
          </p>
        </div>

        {/* annotation panel */}
        <div className="mt-12 rounded-xl border border-[var(--gray-4)] bg-[var(--gray-2)] p-5">
          <p className="mb-4 text-xs font-medium tracking-widest text-[var(--gray-10)] uppercase">
            Highlights &amp; notes
          </p>
          <ul className="space-y-4">
            {highlights.map((h) => (
              <li key={h.id} className="border-l-2 border-[var(--accent-6)] pl-4">
                <p className="text-sm text-[var(--gray-12)]">&ldquo;{h.text}&rdquo;</p>
                {h.note && <p className="mt-1 text-xs text-[var(--gray-10)] italic">{h.note}</p>}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA */}
        <div className="mt-12 rounded-xl border border-dashed border-[var(--gray-6)] p-6 text-center">
          <p className="mb-1 text-base font-semibold text-[var(--gray-12)]">
            Save your own articles
          </p>
          <p className="mb-5 text-sm text-[var(--gray-10)]">
            Paste any URL or upload a PDF. Read it clean, highlight what matters, take notes.
          </p>
          <Link
            href="/"
            className="inline-flex items-center rounded-md bg-[var(--accent-9)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-10)]"
          >
            Open my library →
          </Link>
        </div>
      </div>
    </div>
  );
}
