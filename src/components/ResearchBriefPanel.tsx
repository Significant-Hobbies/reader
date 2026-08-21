'use client';

import { BookOpenCheck, FileText, GitCompareArrows, HelpCircle, Quote } from 'lucide-react';

import type { ResearchBrief, SourceRelationshipMap } from '../lib/research-brief';

interface ResearchBriefPanelProps {
  brief: ResearchBrief;
  sourceMap?: SourceRelationshipMap | null;
  isSourceMapLoading?: boolean;
  theme?: 'light' | 'dark' | 'sepia';
}

type ThemeStyles = {
  text: string;
  muted: string;
  bg: string;
  panelBg: string;
  border: string;
};

function getThemeStyles(theme: 'light' | 'dark' | 'sepia'): ThemeStyles {
  if (theme === 'sepia') {
    return {
      text: 'text-[#5b4636]',
      muted: 'text-[#8b7355]',
      bg: 'bg-[#ede0c8]',
      panelBg: 'bg-[#f4ecd8]',
      border: 'border-[#d4c5a9]',
    };
  }
  if (theme === 'light') {
    return {
      text: 'text-gray-900',
      muted: 'text-gray-600',
      bg: 'bg-gray-100',
      panelBg: 'bg-white',
      border: 'border-gray-300',
    };
  }
  return {
    text: 'text-gray-100',
    muted: 'text-gray-400',
    bg: 'bg-[var(--gray-2)]/80',
    panelBg: 'bg-[var(--gray-1)]/70',
    border: 'border-[var(--gray-5)]',
  };
}

function SourceCount({ count, className }: { count: number; className: string }) {
  return <span className={`ml-2 text-xs ${className}`}>({count} sources)</span>;
}

function ClaimsSection({ brief, styles }: { brief: ResearchBrief; styles: ThemeStyles }) {
  if (brief.claims.length === 0) return null;
  return (
    <div className="space-y-3">
      <h4 className={`text-sm font-semibold ${styles.text}`}>Grounded claims</h4>
      {brief.claims.map((claim) => (
        <div key={claim.id} className={`rounded-md border ${styles.border} ${styles.panelBg} p-4`}>
          <p className={`text-sm leading-6 ${styles.text}`}>{claim.text}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {claim.citationIds.map((citationId) => (
              <span
                key={citationId}
                className={`rounded-full border ${styles.border} px-2 py-1 text-[11px] ${styles.muted}`}
              >
                {citationId}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CitationsSection({ brief, styles }: { brief: ResearchBrief; styles: ThemeStyles }) {
  if (brief.citations.length === 0) return null;
  return (
    <div className="space-y-3">
      <h4 className={`flex items-center gap-2 text-sm font-semibold ${styles.text}`}>
        <Quote className="h-4 w-4" />
        Evidence
      </h4>
      {brief.citations.map((citation) => (
        <blockquote
          key={citation.id}
          className={`rounded-md border-l-4 ${styles.border} ${styles.panelBg} p-4`}
        >
          <div className={`mb-2 text-[11px] font-semibold tracking-wide uppercase ${styles.muted}`}>
            {citation.id} · {citation.label}
          </div>
          <p className={`text-sm leading-6 ${styles.text}`}>{citation.excerpt}</p>
        </blockquote>
      ))}
    </div>
  );
}

function SourceMapSection({
  sourceMap,
  isLoading,
  styles,
}: {
  sourceMap?: SourceRelationshipMap | null;
  isLoading: boolean;
  styles: ThemeStyles;
}) {
  if (!isLoading && !sourceMap?.consensus.length && !sourceMap?.contradictions.length) return null;
  return (
    <div className={`rounded-md border ${styles.border} ${styles.panelBg} p-4`}>
      <h4 className={`mb-3 flex items-center gap-2 text-sm font-semibold ${styles.text}`}>
        <GitCompareArrows className="h-4 w-4" />
        Source map
      </h4>
      {isLoading ? (
        <p className={`text-sm ${styles.muted}`}>Mapping saved sources...</p>
      ) : (
        <div className="space-y-4">
          {sourceMap && sourceMap.consensus.length > 0 && (
            <div>
              <div className={`mb-2 text-xs font-semibold uppercase ${styles.muted}`}>
                Consensus
              </div>
              <ul className="space-y-2">
                {sourceMap.consensus.map((item) => (
                  <li key={item.id} className={`text-sm leading-6 ${styles.text}`}>
                    <span className="font-medium">{item.topic}:</span> {item.summary}
                    <SourceCount count={item.sourceIds.length} className={styles.muted} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {sourceMap && sourceMap.contradictions.length > 0 && (
            <div>
              <div className={`mb-2 text-xs font-semibold uppercase ${styles.muted}`}>
                Contradictions
              </div>
              <div className="space-y-3">
                {sourceMap.contradictions.map((item) => (
                  <div key={item.id} className={`rounded-md border ${styles.border} p-3`}>
                    <div className={`mb-2 text-sm font-medium ${styles.text}`}>
                      {item.topic}
                      <SourceCount count={item.sourceIds.length} className={styles.muted} />
                    </div>
                    <p className={`text-xs leading-5 ${styles.muted}`}>{item.claimA}</p>
                    <p className={`mt-2 text-xs leading-5 ${styles.muted}`}>{item.claimB}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ResearchBriefPanel({
  brief,
  sourceMap,
  isSourceMapLoading = false,
  theme = 'dark',
}: ResearchBriefPanelProps) {
  const styles = getThemeStyles(theme);

  return (
    <section className={`mb-6 overflow-hidden rounded-lg border ${styles.border} ${styles.bg}`}>
      <div className="border-b border-inherit p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className={`flex items-center gap-2 text-lg font-semibold ${styles.text}`}>
              <BookOpenCheck className="h-5 w-5" />
              Research Brief
            </h3>
            <p className={`mt-1 text-sm ${styles.muted}`}>
              Grounded in source excerpts and reader notes from this document.
            </p>
          </div>
          <div
            className={`shrink-0 rounded-md border ${styles.border} ${styles.panelBg} px-3 py-2 text-right`}
          >
            <div className={`text-sm font-semibold ${styles.text}`}>{brief.sourceStats.words}</div>
            <div className={`text-[10px] tracking-wide uppercase ${styles.muted}`}>words</div>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className={`rounded-md border ${styles.border} ${styles.panelBg} p-4`}>
          <div className={`mb-2 flex items-center gap-2 text-sm font-semibold ${styles.text}`}>
            <FileText className="h-4 w-4" />
            Working thesis
          </div>
          <p className={`text-sm leading-6 ${styles.text}`}>{brief.thesis}</p>
        </div>

        <ClaimsSection brief={brief} styles={styles} />
        <CitationsSection brief={brief} styles={styles} />
        <SourceMapSection sourceMap={sourceMap} isLoading={isSourceMapLoading} styles={styles} />

        <div className={`rounded-md border ${styles.border} ${styles.panelBg} p-4`}>
          <h4 className={`mb-3 flex items-center gap-2 text-sm font-semibold ${styles.text}`}>
            <HelpCircle className="h-4 w-4" />
            Open questions
          </h4>
          <ul className="space-y-2">
            {brief.openQuestions.map((question) => (
              <li key={question} className={`text-sm leading-6 ${styles.muted}`}>
                {question}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
