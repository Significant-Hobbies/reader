'use client';

import { useCallback, useState } from 'react';

import { trackCoreAction } from '../lib/analytics';
import type { SummaryLength } from '../types';

interface ArticleSummaryProps {
  article: { id: string; content: string; title: string };
  initial: { summary?: string; keyPoints?: string[] };
  aiConfig: { endpointUrl: string; model: string; apiKey: string };
  theme?: 'light' | 'dark' | 'sepia';
  onSummarySaved?: (summary: string, keyPoints: string[]) => void;
}

type ThemeStyles = {
  text: string;
  bg: string;
  border: string;
  buttonBg: string;
  secondaryBg: string;
  muted: string;
  errorBg: string;
  errorText: string;
  errorLink: string;
  panelBg: string;
  bulletColor: string;
};

function getThemeStyles(theme: 'light' | 'dark' | 'sepia'): ThemeStyles {
  if (theme === 'sepia') {
    return {
      text: 'text-[#5b4636]',
      bg: 'bg-[#ede0c8]',
      border: 'border-[#d4c5a9]',
      buttonBg: 'bg-amber-700 hover:bg-amber-600',
      secondaryBg: 'bg-[#d4c5a9] hover:bg-[#c9b89a]',
      muted: 'text-[#8b7355]',
      errorBg: 'border border-red-200 bg-red-50 text-red-600',
      errorText: 'text-red-600',
      errorLink: 'text-red-700 hover:text-red-800',
      panelBg: 'bg-[#f4ecd8]',
      bulletColor: 'bg-amber-600',
    };
  }
  if (theme === 'light') {
    return {
      text: 'text-gray-900',
      bg: 'bg-gray-100',
      border: 'border-gray-300',
      buttonBg: 'bg-[var(--accent-9)] hover:bg-[var(--accent-10)]',
      secondaryBg: 'bg-gray-200 hover:bg-gray-300',
      muted: 'text-gray-600',
      errorBg: 'border border-red-200 bg-red-50 text-red-600',
      errorText: 'text-red-600',
      errorLink: 'text-red-700 hover:text-red-800',
      panelBg: 'bg-white',
      bulletColor: 'bg-[var(--accent-9)]',
    };
  }
  return {
    text: 'text-gray-100',
    bg: 'bg-[var(--gray-2)]/80',
    border: 'border-[var(--gray-5)]',
    buttonBg: 'bg-[var(--accent-9)] hover:bg-[var(--accent-10)]',
    secondaryBg: 'bg-[var(--gray-3)] hover:bg-[var(--gray-4)]',
    muted: 'text-gray-400',
    errorBg: 'border border-red-800 bg-red-900/20 text-red-400',
    errorText: 'text-red-400',
    errorLink: 'text-red-300 hover:text-red-200',
    panelBg: 'bg-[var(--gray-1)]/70',
    bulletColor: 'bg-[var(--accent-10)]',
  };
}

interface SummaryGenerationConfig {
  articleId: string;
  articleContent: string;
  articleTitle: string;
  endpointUrl: string;
  model: string;
  apiKey: string;
  summaryLength: SummaryLength;
  onSummarySaved?: (summary: string, keyPoints: string[]) => void;
}

function useSummaryGeneration(config: SummaryGenerationConfig) {
  const {
    articleId,
    articleContent,
    articleTitle,
    endpointUrl,
    model,
    apiKey,
    summaryLength,
    onSummarySaved,
  } = config;
  const [isGenerating, setIsGenerating] = useState(false);
  const [summary, setSummary] = useState('');
  const [keyPoints, setKeyPoints] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const generateSummary = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointUrl,
          model,
          apiKey,
          articleContent,
          articleTitle,
          summaryLength,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate summary');
      }

      const data = await response.json();
      setSummary(data.summary);
      setKeyPoints(data.keyPoints || []);

      // Analytics — core action: an AI summary was generated.
      trackCoreAction('summary_generated');

      // Save to database
      await fetch(`/api/articles/${articleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiSummary: data.summary,
          keyPoints: data.keyPoints,
        }),
      });

      if (onSummarySaved) {
        onSummarySaved(data.summary, data.keyPoints);
      }
    } catch (err) {
      console.error('Error generating summary:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate summary');
    } finally {
      setIsGenerating(false);
    }
  }, [
    endpointUrl,
    model,
    apiKey,
    articleContent,
    articleTitle,
    summaryLength,
    articleId,
    onSummarySaved,
  ]);

  return { isGenerating, summary, keyPoints, error, generateSummary };
}

function SummaryLengthSelector({
  summaryLength,
  onSelect,
  styles,
}: {
  summaryLength: SummaryLength;
  onSelect: (length: SummaryLength) => void;
  styles: ThemeStyles;
}) {
  return (
    <div className="flex items-center gap-2">
      <label className={`text-sm font-medium ${styles.text}`}>Length:</label>
      <div className="flex gap-2">
        {(['short', 'medium', 'long'] as SummaryLength[]).map((length) => (
          <button
            key={length}
            onClick={() => onSelect(length)}
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
              summaryLength === length
                ? styles.buttonBg + ' text-white'
                : styles.secondaryBg + ' ' + styles.text
            }`}
          >
            {length.charAt(0).toUpperCase() + length.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}

function SummaryDisplay({
  summary,
  keyPoints,
  isGenerating,
  onRegenerate,
  styles,
}: {
  summary: string;
  keyPoints: string[];
  isGenerating: boolean;
  onRegenerate: () => void;
  styles: ThemeStyles;
}) {
  return (
    <div className="space-y-4">
      <div className={`rounded-md p-4 ${styles.panelBg} border ${styles.border}`}>
        <h4 className={`mb-2 text-sm font-semibold ${styles.text}`}>Summary</h4>
        <p className={`text-sm leading-relaxed ${styles.text}`}>{summary}</p>
      </div>

      {keyPoints.length > 0 && (
        <div className={`rounded-md p-4 ${styles.panelBg} border ${styles.border}`}>
          <h4 className={`mb-3 text-sm font-semibold ${styles.text}`}>Key Points</h4>
          <ul className="space-y-2">
            {keyPoints.map((point, index) => (
              <li key={index} className={`flex items-start gap-2 text-sm ${styles.text}`}>
                <span
                  className={`mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${styles.bulletColor}`}
                ></span>
                <span className="flex-1">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={onRegenerate}
        disabled={isGenerating}
        className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${styles.secondaryBg} ${styles.text} hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50`}
      >
        Regenerate Summary
      </button>
    </div>
  );
}

function SummaryHeader({
  isExpanded,
  onToggle,
  styles,
}: {
  isExpanded: boolean;
  onToggle: () => void;
  styles: ThemeStyles;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h3 className={`text-lg font-semibold ${styles.text} flex items-center gap-2`}>
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        AI Summary
      </h3>
      <button
        onClick={onToggle}
        className={`rounded-md p-2 ${styles.secondaryBg} ${styles.text} transition-colors`}
        title={isExpanded ? 'Collapse' : 'Expand'}
      >
        <svg
          className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );
}

function GeneratingState({ styles }: { styles: ThemeStyles }) {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--accent-10)]"></div>
        <p className={`text-sm ${styles.muted}`}>Generating summary...</p>
      </div>
    </div>
  );
}

export function ArticleSummary({
  article,
  initial,
  aiConfig,
  theme = 'dark',
  onSummarySaved,
}: ArticleSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(!!initial.summary);
  const [summaryLength, setSummaryLength] = useState<SummaryLength>('medium');

  const { isGenerating, summary, keyPoints, error, generateSummary } = useSummaryGeneration({
    articleId: article.id,
    articleContent: article.content,
    articleTitle: article.title,
    endpointUrl: aiConfig.endpointUrl,
    model: aiConfig.model,
    apiKey: aiConfig.apiKey,
    summaryLength,
    onSummarySaved,
  });

  const displaySummary = summary || initial.summary || '';
  const displayKeyPoints = keyPoints.length > 0 ? keyPoints : initial.keyPoints || [];
  const styles = getThemeStyles(theme);

  return (
    <div className={`mb-6 border ${styles.border} overflow-hidden rounded-lg ${styles.bg}`}>
      <div className="p-4">
        <SummaryHeader
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
          styles={styles}
        />

        {isExpanded && (
          <div className="space-y-4">
            {!displaySummary && !isGenerating && (
              <div className="space-y-3">
                <p className={`text-sm ${styles.muted}`}>
                  Generate an AI-powered summary and key points for this article.
                </p>
                <SummaryLengthSelector
                  summaryLength={summaryLength}
                  onSelect={setSummaryLength}
                  styles={styles}
                />
                <button
                  onClick={generateSummary}
                  disabled={isGenerating}
                  className={`w-full rounded-md px-4 py-2 font-medium text-white transition-colors ${styles.buttonBg} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  Generate Summary
                </button>
              </div>
            )}

            {isGenerating && <GeneratingState styles={styles} />}

            {error && (
              <div className={`rounded-md p-3 ${styles.errorBg}`}>
                <p className="text-sm font-medium">Error: {error}</p>
                <button
                  onClick={generateSummary}
                  className={`mt-2 text-sm underline ${styles.errorLink}`}
                >
                  Try again
                </button>
              </div>
            )}

            {displaySummary && !isGenerating && (
              <SummaryDisplay
                summary={displaySummary}
                keyPoints={displayKeyPoints}
                isGenerating={isGenerating}
                onRegenerate={generateSummary}
                styles={styles}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
