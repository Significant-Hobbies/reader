import type { Metadata } from 'next';
import Link from 'next/link';

import { MemoryPrototypeClient } from '@/components/MemoryPrototypeClient';
import {
  buildPrototypeCorpus,
  ingestMemoryCaptureFixtures,
  loadMemoryCaptureFixture,
} from '@/lib/memory-capture';

export const metadata: Metadata = {
  title: 'Memory capture prototype — Reader',
  description: 'Fixture-backed browser memory search prototype (web, blog, PDF captures).',
  robots: { index: false, follow: false },
};

export default function MemoryPrototypePage() {
  const corpus = buildPrototypeCorpus();
  const { demoQueries } = loadMemoryCaptureFixture();
  const typed = ingestMemoryCaptureFixtures();

  return (
    <div className="min-h-screen bg-[var(--gray-1)] text-[var(--gray-12)]">
      <div className="border-b border-[var(--gray-4)] px-6 py-3">
        <Link href="/" className="text-sm text-[var(--gray-11)] underline-offset-2 hover:underline">
          ← Back
        </Link>
      </div>
      <MemoryPrototypeClient corpus={corpus} demoQueries={demoQueries} />
      <section className="mx-auto max-w-3xl border-t border-[var(--gray-4)] px-6 py-6 text-xs text-[var(--gray-9)]">
        <p className="font-medium text-[var(--gray-11)]">Loaded capture kinds</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          {typed.map((c) => (
            <li key={c.id}>
              {c.kind}: {c.title}
            </li>
          ))}
          <li>browser-memory mock: {corpus.length - typed.length} extension snapshot(s)</li>
        </ul>
        <p className="mt-4">
          CLI: <code className="text-[var(--gray-11)]">pnpm memory:demo</code> or{' '}
          <code className="text-[var(--gray-11)]">pnpm test -- memory-capture</code>
        </p>
      </section>
    </div>
  );
}
