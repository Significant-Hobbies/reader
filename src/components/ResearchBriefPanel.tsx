'use client';

import { BookOpenCheck, FileText, HelpCircle, Quote } from 'lucide-react';

import type { ResearchBrief } from '../lib/research-brief';

interface ResearchBriefPanelProps {
  brief: ResearchBrief;
  theme?: 'light' | 'dark' | 'sepia';
}

export function ResearchBriefPanel({ brief, theme = 'dark' }: ResearchBriefPanelProps) {
  const textColor =
    theme === 'dark' ? 'text-gray-100' : theme === 'sepia' ? 'text-[#5b4636]' : 'text-gray-900';
  const mutedColor =
    theme === 'dark' ? 'text-gray-400' : theme === 'sepia' ? 'text-[#8b7355]' : 'text-gray-600';
  const bgColor =
    theme === 'dark' ? 'bg-[var(--gray-2)]/80' : theme === 'sepia' ? 'bg-[#ede0c8]' : 'bg-gray-100';
  const panelBg =
    theme === 'dark' ? 'bg-[var(--gray-1)]/70' : theme === 'sepia' ? 'bg-[#f4ecd8]' : 'bg-white';
  const borderColor =
    theme === 'dark'
      ? 'border-[var(--gray-5)]'
      : theme === 'sepia'
        ? 'border-[#d4c5a9]'
        : 'border-gray-300';

  return (
    <section className={`mb-6 overflow-hidden rounded-lg border ${borderColor} ${bgColor}`}>
      <div className="border-b border-inherit p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className={`flex items-center gap-2 text-lg font-semibold ${textColor}`}>
              <BookOpenCheck className="h-5 w-5" />
              Research Brief
            </h3>
            <p className={`mt-1 text-sm ${mutedColor}`}>
              Grounded in source excerpts and reader notes from this document.
            </p>
          </div>
          <div
            className={`shrink-0 rounded-md border ${borderColor} ${panelBg} px-3 py-2 text-right`}
          >
            <div className={`text-sm font-semibold ${textColor}`}>{brief.sourceStats.words}</div>
            <div className={`text-[10px] tracking-wide uppercase ${mutedColor}`}>words</div>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <div className={`rounded-md border ${borderColor} ${panelBg} p-4`}>
          <div className={`mb-2 flex items-center gap-2 text-sm font-semibold ${textColor}`}>
            <FileText className="h-4 w-4" />
            Working thesis
          </div>
          <p className={`text-sm leading-6 ${textColor}`}>{brief.thesis}</p>
        </div>

        {brief.claims.length > 0 && (
          <div className="space-y-3">
            <h4 className={`text-sm font-semibold ${textColor}`}>Grounded claims</h4>
            {brief.claims.map((claim) => (
              <div key={claim.id} className={`rounded-md border ${borderColor} ${panelBg} p-4`}>
                <p className={`text-sm leading-6 ${textColor}`}>{claim.text}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {claim.citationIds.map((citationId) => (
                    <span
                      key={citationId}
                      className={`rounded-full border ${borderColor} px-2 py-1 text-[11px] ${mutedColor}`}
                    >
                      {citationId}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {brief.citations.length > 0 && (
          <div className="space-y-3">
            <h4 className={`flex items-center gap-2 text-sm font-semibold ${textColor}`}>
              <Quote className="h-4 w-4" />
              Evidence
            </h4>
            {brief.citations.map((citation) => (
              <blockquote
                key={citation.id}
                className={`rounded-md border-l-4 ${borderColor} ${panelBg} p-4`}
              >
                <div
                  className={`mb-2 text-[11px] font-semibold tracking-wide uppercase ${mutedColor}`}
                >
                  {citation.id} · {citation.label}
                </div>
                <p className={`text-sm leading-6 ${textColor}`}>{citation.excerpt}</p>
              </blockquote>
            ))}
          </div>
        )}

        <div className={`rounded-md border ${borderColor} ${panelBg} p-4`}>
          <h4 className={`mb-3 flex items-center gap-2 text-sm font-semibold ${textColor}`}>
            <HelpCircle className="h-4 w-4" />
            Open questions
          </h4>
          <ul className="space-y-2">
            {brief.openQuestions.map((question) => (
              <li key={question} className={`text-sm leading-6 ${mutedColor}`}>
                {question}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
