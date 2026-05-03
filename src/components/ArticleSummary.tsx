'use client';

import { useCallback, useState } from 'react';

import type { SummaryLength } from '../types';

interface ArticleSummaryProps {
  articleId: string;
  articleContent: string;
  articleTitle: string;
  initialSummary?: string;
  initialKeyPoints?: string[];
  endpointUrl: string;
  model: string;
  apiKey: string;
  theme?: 'light' | 'dark' | 'sepia';
  onSummarySaved?: (summary: string, keyPoints: string[]) => void;
}

export function ArticleSummary({
  articleId,
  articleContent,
  articleTitle,
  initialSummary,
  initialKeyPoints,
  endpointUrl,
  model,
  apiKey,
  theme = 'dark',
  onSummarySaved,
}: ArticleSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(!!initialSummary);
  const [isGenerating, setIsGenerating] = useState(false);
  const [summary, setSummary] = useState(initialSummary || '');
  const [keyPoints, setKeyPoints] = useState<string[]>(initialKeyPoints || []);
  const [error, setError] = useState<string | null>(null);
  const [summaryLength, setSummaryLength] = useState<SummaryLength>('medium');

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

      setIsExpanded(true);
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

  const textColor =
    theme === 'dark' ? 'text-gray-100' : theme === 'sepia' ? 'text-[#5b4636]' : 'text-gray-900';
  const bgColor =
    theme === 'dark' ? 'bg-[var(--gray-2)]/80' : theme === 'sepia' ? 'bg-[#ede0c8]' : 'bg-gray-100';
  const borderColor =
    theme === 'dark'
      ? 'border-[var(--gray-5)]'
      : theme === 'sepia'
        ? 'border-[#d4c5a9]'
        : 'border-gray-300';
  const buttonBgColor =
    theme === 'dark'
      ? 'bg-[var(--accent-9)] hover:bg-[var(--accent-10)]'
      : theme === 'sepia'
        ? 'bg-amber-700 hover:bg-amber-600'
        : 'bg-[var(--accent-9)] hover:bg-[var(--accent-10)]';
  const secondaryBgColor =
    theme === 'dark'
      ? 'bg-[var(--gray-3)] hover:bg-[var(--gray-4)]'
      : theme === 'sepia'
        ? 'bg-[#d4c5a9] hover:bg-[#c9b89a]'
        : 'bg-gray-200 hover:bg-gray-300';

  return (
    <div className={`mb-6 border ${borderColor} overflow-hidden rounded-lg ${bgColor}`}>
      <div className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className={`text-lg font-semibold ${textColor} flex items-center gap-2`}>
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
            onClick={() => setIsExpanded(!isExpanded)}
            className={`rounded-md p-2 ${secondaryBgColor} ${textColor} transition-colors`}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            <svg
              className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>

        {isExpanded && (
          <div className="space-y-4">
            {!summary && !isGenerating && (
              <div className="space-y-3">
                <p
                  className={`text-sm ${theme === 'dark' ? 'text-gray-400' : theme === 'sepia' ? 'text-[#8b7355]' : 'text-gray-600'}`}
                >
                  Generate an AI-powered summary and key points for this article.
                </p>

                <div className="flex items-center gap-2">
                  <label className={`text-sm font-medium ${textColor}`}>Length:</label>
                  <div className="flex gap-2">
                    {(['short', 'medium', 'long'] as SummaryLength[]).map((length) => (
                      <button
                        key={length}
                        onClick={() => setSummaryLength(length)}
                        className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
                          summaryLength === length
                            ? buttonBgColor + ' text-white'
                            : secondaryBgColor + ' ' + textColor
                        }`}
                      >
                        {length.charAt(0).toUpperCase() + length.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={generateSummary}
                  disabled={isGenerating}
                  className={`w-full rounded-md px-4 py-2 font-medium text-white transition-colors ${buttonBgColor} disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  Generate Summary
                </button>
              </div>
            )}

            {isGenerating && (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-b-2 border-[var(--accent-10)]"></div>
                  <p
                    className={`text-sm ${theme === 'dark' ? 'text-gray-400' : theme === 'sepia' ? 'text-[#8b7355]' : 'text-gray-600'}`}
                  >
                    Generating summary...
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div
                className={`rounded-md p-3 ${theme === 'dark' ? 'border border-red-800 bg-red-900/20 text-red-400' : 'border border-red-200 bg-red-50 text-red-600'}`}
              >
                <p className="text-sm font-medium">Error: {error}</p>
                <button
                  onClick={generateSummary}
                  className={`mt-2 text-sm underline ${theme === 'dark' ? 'text-red-300 hover:text-red-200' : 'text-red-700 hover:text-red-800'}`}
                >
                  Try again
                </button>
              </div>
            )}

            {summary && !isGenerating && (
              <div className="space-y-4">
                <div
                  className={`rounded-md p-4 ${theme === 'dark' ? 'bg-[var(--gray-1)]/70' : theme === 'sepia' ? 'bg-[#f4ecd8]' : 'bg-white'} border ${borderColor}`}
                >
                  <h4 className={`mb-2 text-sm font-semibold ${textColor}`}>Summary</h4>
                  <p className={`text-sm leading-relaxed ${textColor}`}>{summary}</p>
                </div>

                {keyPoints.length > 0 && (
                  <div
                    className={`rounded-md p-4 ${theme === 'dark' ? 'bg-[var(--gray-1)]/70' : theme === 'sepia' ? 'bg-[#f4ecd8]' : 'bg-white'} border ${borderColor}`}
                  >
                    <h4 className={`mb-3 text-sm font-semibold ${textColor}`}>Key Points</h4>
                    <ul className="space-y-2">
                      {keyPoints.map((point, index) => (
                        <li key={index} className={`flex items-start gap-2 text-sm ${textColor}`}>
                          <span
                            className={`mt-1.5 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${theme === 'dark' ? 'bg-[var(--accent-10)]' : theme === 'sepia' ? 'bg-amber-600' : 'bg-[var(--accent-9)]'}`}
                          ></span>
                          <span className="flex-1">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  onClick={generateSummary}
                  disabled={isGenerating}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${secondaryBgColor} ${textColor} hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  Regenerate Summary
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
