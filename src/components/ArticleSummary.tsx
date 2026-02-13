'use client';

import { useState, useCallback } from 'react';
import { SummaryLength } from '../types';

interface ArticleSummaryProps {
  articleId: string;
  articleContent: string;
  articleTitle: string;
  initialSummary?: string;
  initialKeyPoints?: string[];
  provider: string;
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
  provider,
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
          provider,
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
    provider,
    model,
    apiKey,
    articleContent,
    articleTitle,
    summaryLength,
    articleId,
    onSummarySaved,
  ]);

  const textColor = theme === 'dark' ? 'text-gray-100' : theme === 'sepia' ? 'text-[#5b4636]' : 'text-gray-900';
  const bgColor = theme === 'dark' ? 'bg-gray-800/50' : theme === 'sepia' ? 'bg-[#ede0c8]' : 'bg-gray-100';
  const borderColor = theme === 'dark' ? 'border-gray-700' : theme === 'sepia' ? 'border-[#d4c5a9]' : 'border-gray-300';
  const buttonBgColor = theme === 'dark' ? 'bg-blue-600 hover:bg-blue-500' : theme === 'sepia' ? 'bg-amber-700 hover:bg-amber-600' : 'bg-blue-500 hover:bg-blue-400';
  const secondaryBgColor = theme === 'dark' ? 'bg-gray-700/50 hover:bg-gray-700' : theme === 'sepia' ? 'bg-[#d4c5a9] hover:bg-[#c9b89a]' : 'bg-gray-200 hover:bg-gray-300';

  return (
    <div className={`mb-6 border ${borderColor} rounded-xl overflow-hidden ${bgColor}`}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className={`text-lg font-semibold ${textColor} flex items-center gap-2`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            AI Summary
          </h3>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`p-2 rounded-lg ${secondaryBgColor} ${textColor} transition-colors`}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {isExpanded && (
          <div className="space-y-4">
            {!summary && !isGenerating && (
              <div className="space-y-3">
                <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : theme === 'sepia' ? 'text-[#8b7355]' : 'text-gray-600'}`}>
                  Generate an AI-powered summary and key points for this article.
                </p>

                <div className="flex items-center gap-2">
                  <label className={`text-sm font-medium ${textColor}`}>Length:</label>
                  <div className="flex gap-2">
                    {(['short', 'medium', 'long'] as SummaryLength[]).map((length) => (
                      <button
                        key={length}
                        onClick={() => setSummaryLength(length)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
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
                  className={`w-full px-4 py-2 rounded-lg text-white font-medium transition-colors ${buttonBgColor} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  Generate Summary
                </button>
              </div>
            )}

            {isGenerating && (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
                  <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : theme === 'sepia' ? 'text-[#8b7355]' : 'text-gray-600'}`}>
                    Generating summary...
                  </p>
                </div>
              </div>
            )}

            {error && (
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-red-900/20 border border-red-800 text-red-400' : 'bg-red-50 border border-red-200 text-red-600'}`}>
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
                <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-900/50' : theme === 'sepia' ? 'bg-[#f4ecd8]' : 'bg-white'} border ${borderColor}`}>
                  <h4 className={`text-sm font-semibold mb-2 ${textColor}`}>Summary</h4>
                  <p className={`text-sm leading-relaxed ${textColor}`}>{summary}</p>
                </div>

                {keyPoints.length > 0 && (
                  <div className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-900/50' : theme === 'sepia' ? 'bg-[#f4ecd8]' : 'bg-white'} border ${borderColor}`}>
                    <h4 className={`text-sm font-semibold mb-3 ${textColor}`}>Key Points</h4>
                    <ul className="space-y-2">
                      {keyPoints.map((point, index) => (
                        <li key={index} className={`text-sm flex items-start gap-2 ${textColor}`}>
                          <span className={`inline-block w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${theme === 'dark' ? 'bg-blue-400' : theme === 'sepia' ? 'bg-amber-600' : 'bg-blue-500'}`}></span>
                          <span className="flex-1">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <button
                  onClick={generateSummary}
                  disabled={isGenerating}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${secondaryBgColor} ${textColor} hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed`}
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
