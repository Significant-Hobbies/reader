'use client';

import { Brain, FlaskConical, LayoutList, X, Zap } from 'lucide-react';
import { useState } from 'react';

const DISMISSED_KEY = 'review-pack-banner-dismissed';

const perks = [
  { icon: LayoutList, label: 'Flashcards from your highlights' },
  { icon: FlaskConical, label: 'Quiz questions on key ideas' },
  { icon: Brain, label: 'Spaced repetition schedule' },
];

export function ReviewPackBanner() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(DISMISSED_KEY) === '1';
  });

  if (dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--accent-6)]/50 bg-gradient-to-br from-[var(--accent-3)]/60 via-[var(--accent-2)]/40 to-[var(--gray-2)] px-5 py-4">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-3 right-3 rounded-md p-1 text-[var(--gray-9)] transition-colors hover:bg-[var(--gray-4)] hover:text-[var(--gray-12)]"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-lg">
          <div className="mb-1 flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-[var(--accent-10)]" />
            <span className="text-[10px] font-semibold tracking-widest text-[var(--accent-11)] uppercase">
              Review Pack · Coming soon
            </span>
          </div>
          <p className="text-sm leading-snug font-semibold text-[var(--gray-12)]">
            Turn your highlights into memory — automatically.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--gray-10)]">
            Reader builds a study pack from everything you&apos;ve annotated. Read once. Remember
            forever.
          </p>

          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
            {perks.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-1.5 text-xs text-[var(--gray-11)]">
                <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--accent-9)]" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent-9)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[var(--accent-10)] active:scale-95"
          >
            <Zap className="h-3.5 w-3.5" />
            Get early access
          </button>
          <span className="text-[10px] text-[var(--gray-9)]">Free while in preview</span>
        </div>
      </div>
    </div>
  );
}
