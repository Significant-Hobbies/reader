'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { Article, ReaderSettings } from '../types';
import { AppearanceToolbar } from './AppearanceToolbar';
import { Navbar } from './Navbar';
import { NotesAIChat } from './NotesAIChat';
import { PDFViewer } from './PDFViewer';

export default function PDFReaderClient({ articleId }: { articleId: string }) {
  const id = articleId;
  const router = useRouter();

  const [activeSidebarTab, setActiveSidebarTab] = useState<'notes' | 'ai'>('notes');
  const [settings, setSettings] = useState<ReaderSettings>({
    fontSize: 'medium',
    theme: 'dark',
    fontFamily: 'sans',
  });

  const {
    data: article,
    isLoading: isArticleLoading,
    error: articleError,
  } = useQuery<Article>({
    queryKey: ['article', id],
    queryFn: async () => {
      const response = await fetch(`/api/articles/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('NOT_FOUND');
        }
        throw new Error('Failed to fetch article');
      }
      return response.json();
    },
    enabled: Boolean(id),
  });

  const updateSettings = (newSettings: Partial<ReaderSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  if (isArticleLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#15130f]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--accent-10)]"></div>
          <p className="text-gray-400">Loading PDF...</p>
        </div>
      </div>
    );
  }

  if (articleError && !article) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#15130f] text-gray-200">
        <p>{articleError.message === 'NOT_FOUND' ? 'PDF not found.' : 'Failed to load PDF.'}</p>
        <button
          onClick={() => router.push('/')}
          className="rounded-md bg-[var(--accent-9)] px-4 py-2 text-white transition hover:bg-[var(--accent-10)]"
        >
          Back to Library
        </button>
      </div>
    );
  }

  if (!article || !article.pdfUrl) return null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#15130f] bg-[radial-gradient(circle_at_top_left,rgba(180,140,92,0.10),transparent_32rem)] font-sans text-gray-100">
      <Navbar />
      <div className="flex flex-1 gap-4 overflow-hidden p-4 md:p-6">
        {/* LEFT PANEL: PDF Viewer */}
        <div className="flex h-full flex-1 flex-col overflow-hidden rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)]/85 shadow-[0_18px_55px_rgba(0,0,0,0.22)] backdrop-blur">
          {/* Header */}
          <div className="z-10 flex flex-wrap items-center gap-4 border-b border-[var(--gray-5)] bg-[var(--gray-2)]/90 p-4 shadow-md backdrop-blur-md">
            <button
              onClick={() => router.push('/')}
              className="rounded-md border border-[var(--gray-6)] bg-[var(--gray-3)] p-2 text-gray-200 transition-colors hover:bg-[var(--gray-4)]"
              title="Back to Library"
            >
              ←
            </button>

            <div className="min-w-[220px] flex-1">
              <h1 className="text-2xl font-semibold text-white">
                {article.title || 'PDF Document'}
              </h1>
              {article.pdfMetadata?.pageCount && (
                <p className="mt-1 text-xs text-gray-400">{article.pdfMetadata.pageCount} pages</p>
              )}
            </div>

            <div className="ml-auto flex items-center gap-4">
              <AppearanceToolbar settings={settings} onUpdate={updateSettings} />
            </div>
          </div>

          {/* PDF Content */}
          <div className="flex-grow overflow-hidden">
            <PDFViewer pdfUrl={article.pdfUrl} settings={settings} />
          </div>
        </div>

        {/* RIGHT PANEL: Notes & AI Chat */}
        <div className="z-20 flex h-full w-[400px] flex-col rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)]/85 shadow-[0_18px_55px_rgba(0,0,0,0.22)] backdrop-blur">
          <div className="border-b border-[var(--gray-5)] bg-[var(--gray-2)]/90 p-4">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveSidebarTab('notes')}
                className={`flex-1 rounded-md px-4 py-2 font-medium transition-colors ${
                  activeSidebarTab === 'notes'
                    ? 'bg-[var(--accent-9)] text-white'
                    : 'bg-[var(--gray-3)] text-gray-400 hover:bg-[var(--gray-4)] hover:text-gray-200'
                }`}
              >
                Notes
              </button>
              <button
                onClick={() => setActiveSidebarTab('ai')}
                className={`flex-1 rounded-md px-4 py-2 font-medium transition-colors ${
                  activeSidebarTab === 'ai'
                    ? 'bg-[var(--accent-9)] text-white'
                    : 'bg-[var(--gray-3)] text-gray-400 hover:bg-[var(--gray-4)] hover:text-gray-200'
                }`}
              >
                AI Chat
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            {activeSidebarTab === 'notes' ? (
              <div className="h-full overflow-y-auto p-6">
                <div className="py-12 text-center">
                  <p className="mb-4 text-gray-400">PDF annotations coming soon</p>
                  <p className="text-sm text-gray-500">
                    Use the AI Chat to ask questions about this PDF
                  </p>
                </div>
              </div>
            ) : (
              <NotesAIChat article={article} notes={[]} queuedPrompt={null} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
