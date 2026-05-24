'use client';

import { ChevronDown, ChevronUp, ClipboardList, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import type { SessionReview } from '../../types';

interface Props {
  review: SessionReview;
  isRegenerating: boolean;
  onRegenerate: () => void;
}

export function SessionReviewPanel({ review, isRegenerating, onRegenerate }: Props) {
  const [expanded, setExpanded] = useState(true);

  const date = new Date(review.generatedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="rounded-lg border border-[var(--accent-6)] bg-[var(--accent-2)]/60">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <ClipboardList className="h-3.5 w-3.5 shrink-0 text-[var(--accent-11)]" />
          <span className="text-xs font-semibold text-[var(--accent-12)]">Session Review</span>
          <span className="text-[10px] text-[var(--gray-10)]">{date}</span>
        </div>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0 text-[var(--gray-10)]" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[var(--gray-10)]" />
        )}
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-[var(--accent-5)] px-3 pt-2.5 pb-3">
          <section>
            <h4 className="mb-1 text-[10px] font-semibold tracking-wider text-[var(--gray-10)] uppercase">
              What you read
            </h4>
            <p className="text-xs leading-5 text-[var(--gray-12)]">{review.summary}</p>
          </section>

          {review.notesSummary && (
            <section>
              <h4 className="mb-1 text-[10px] font-semibold tracking-wider text-[var(--gray-10)] uppercase">
                Your focus
              </h4>
              <p className="text-xs leading-5 text-[var(--gray-11)]">{review.notesSummary}</p>
            </section>
          )}

          {review.keyThemes.length > 0 && (
            <section>
              <h4 className="mb-1.5 text-[10px] font-semibold tracking-wider text-[var(--gray-10)] uppercase">
                Key themes
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {review.keyThemes.map((theme) => (
                  <span
                    key={theme}
                    className="inline-flex items-center rounded-full border border-[var(--accent-6)] bg-[var(--accent-3)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent-11)]"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            </section>
          )}

          {review.actionItems.length > 0 && (
            <section>
              <h4 className="mb-1 text-[10px] font-semibold tracking-wider text-[var(--gray-10)] uppercase">
                Action items
              </h4>
              <ul className="space-y-1">
                {review.actionItems.map((item) => (
                  <li key={item} className="flex items-start gap-1.5 text-xs text-[var(--gray-12)]">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-9)]" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <button
            type="button"
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--gray-6)] bg-[var(--gray-3)] px-2.5 py-1.5 text-[10px] font-medium text-[var(--gray-11)] transition-colors hover:bg-[var(--gray-4)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${isRegenerating ? 'animate-spin' : ''}`} />
            {isRegenerating ? 'Regenerating…' : 'Regenerate'}
          </button>
        </div>
      )}
    </div>
  );
}
