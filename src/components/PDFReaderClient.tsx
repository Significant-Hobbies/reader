'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Article, ReaderSettings } from '../types';
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
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading PDF...</p>
        </div>
      </div>
    );
  }

  if (articleError && !article) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-900 text-gray-200 gap-4">
        <p>{articleError.message === 'NOT_FOUND' ? 'PDF not found.' : 'Failed to load PDF.'}</p>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition"
        >
          Back to Library
        </button>
      </div>
    );
  }

  if (!article || !article.pdfUrl) return null;

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-black via-gray-950 to-gray-900 font-sans text-gray-100 overflow-hidden">
      <Navbar />
      <div className="flex flex-1 overflow-hidden p-4 md:p-6 gap-4">
        {/* LEFT PANEL: PDF Viewer */}
        <div className="flex-1 h-full flex flex-col bg-gray-900/70 backdrop-blur border border-gray-800 rounded-2xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="p-4 border-b border-gray-800 bg-gray-900/80 backdrop-blur-md z-10 shadow-md flex flex-wrap items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 rounded-lg bg-gray-800/60 hover:bg-gray-800 text-gray-200 transition-colors border border-gray-700"
              title="Back to Library"
            >
              ←
            </button>

            <div className="flex-1 min-w-[220px]">
              <h1 className="text-2xl font-semibold text-white">
                {article.title || 'PDF Document'}
              </h1>
              {article.pdfMetadata?.pageCount && (
                <p className="text-xs text-gray-400 mt-1">{article.pdfMetadata.pageCount} pages</p>
              )}
            </div>

            <div className="flex items-center gap-4 ml-auto">
              <AppearanceToolbar settings={settings} onUpdate={updateSettings} />
            </div>
          </div>

          {/* PDF Content */}
          <div className="flex-grow overflow-hidden">
            <PDFViewer pdfUrl={article.pdfUrl} settings={settings} />
          </div>
        </div>

        {/* RIGHT PANEL: Notes & AI Chat */}
        <div className="w-[400px] h-full bg-gray-900/70 backdrop-blur flex flex-col shadow-2xl z-20 border border-gray-800 rounded-2xl">
          <div className="p-4 border-b border-gray-800 bg-gray-900/80">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveSidebarTab('notes')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeSidebarTab === 'notes'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800/80 hover:text-gray-200'
                }`}
              >
                Notes
              </button>
              <button
                onClick={() => setActiveSidebarTab('ai')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeSidebarTab === 'ai'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800/80 hover:text-gray-200'
                }`}
              >
                AI Chat
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            {activeSidebarTab === 'notes' ? (
              <div className="h-full p-6 overflow-y-auto">
                <div className="text-center py-12">
                  <p className="text-gray-400 mb-4">PDF annotations coming soon</p>
                  <p className="text-sm text-gray-500">
                    Use the AI Chat to ask questions about this PDF
                  </p>
                </div>
              </div>
            ) : (
              <NotesAIChat
                articleId={id}
                aiChat={article.aiChat ?? []}
                textContent={article.extractedText || article.content}
                queuedPrompt={null}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
