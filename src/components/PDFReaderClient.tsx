import { accountArticleKey } from '../lib/article-query';
import { saveAccountNotes } from '../lib/save-account-notes';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

import type { Article, Note, ReaderSettings } from '../types';
import { AppearanceToolbar } from './AppearanceToolbar';
import { useAuth } from './AuthProvider';
import { PdfPageNotes } from './PdfPageNotes';
import { Navbar } from './Navbar';
import { NotesAIChat } from './NotesAIChat';
import { PDFViewer } from './PDFViewer';
import { TTSPlayer } from './TTSPlayer';
import { Button } from './ui/button';

function LoadingState() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#15130f]">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--accent-10)]"></div>
        <p className="text-gray-400">Loading PDF...</p>
      </div>
    </div>
  );
}

function ErrorState({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#15130f] text-gray-200">
      <p>{message}</p>
      <button
        onClick={onBack}
        className="rounded-md bg-[var(--accent-9)] px-4 py-2 text-white transition hover:bg-[var(--accent-10)]"
      >
        Back to Library
      </button>
    </div>
  );
}

async function fetchArticle(id: string): Promise<Article> {
  const response = await fetch(`/api/articles/${id}`);
  if (!response.ok) {
    if (response.status === 404) throw new Error('NOT_FOUND');
    throw new Error('Failed to fetch article');
  }
  return response.json();
}

export default function PDFReaderClient({ articleId }: { articleId: string }) {
  const id = articleId;
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const navigate = useNavigate();

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
    queryKey: accountArticleKey(user, id),
    queryFn: () => fetchArticle(id),
    enabled: Boolean(id && user),
  });

  async function saveNotes(notes: Note[], baseNotes: Note[]) {
    await saveAccountNotes(id, baseNotes, notes);
    const saved = await fetchArticle(id);
    queryClient.setQueryData(accountArticleKey(user, id), saved);
  }

  const updateSettings = (newSettings: Partial<ReaderSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  if (isArticleLoading) return <LoadingState />;

  if (articleError && !article) {
    return (
      <ErrorState
        message={articleError.message === 'NOT_FOUND' ? 'PDF not found.' : 'Failed to load PDF.'}
        onBack={() => navigate('/library')}
      />
    );
  }

  if (!article || !article.pdfUrl) return null;

  return (
    <div className="flex min-h-screen flex-col bg-[#15130f] lg:h-screen lg:overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(180,140,92,0.10),transparent_32rem)] font-sans text-gray-100">
      <Navbar />
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 md:p-6 lg:flex-row lg:overflow-hidden">
        {/* LEFT PANEL: PDF Viewer */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)]/85 shadow-[0_18px_55px_rgba(0,0,0,0.22)] backdrop-blur">
          {/* Header */}
          <div className="z-10 flex flex-wrap items-center gap-4 border-b border-[var(--gray-5)] bg-[var(--gray-2)]/90 p-4 shadow-md backdrop-blur-md">
            <button
              onClick={() => navigate('/library')}
              className="rounded-md border border-[var(--gray-6)] bg-[var(--gray-3)] p-2 text-gray-200 transition-colors hover:bg-[var(--gray-4)]"
              title="Back to Library"
            >
              ←
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold text-white">
                {article.title || 'PDF Document'}
              </h1>
              {article.pdfMetadata?.pageCount && (
                <p className="mt-1 text-xs text-gray-400">{article.pdfMetadata.pageCount} pages</p>
              )}
            </div>

            <PdfReadingTools settings={settings} onUpdate={updateSettings} />
          </div>

          {/* PDF Content */}
          <div className="min-h-0 flex-grow overflow-auto">
            <PDFViewer
              pdfUrl={article.pdfUrl}
              settings={settings}
              page={page}
              onPageChange={setPage}
              onDocumentLoad={setPages}
            />
          </div>
        </div>

        <AccountPdfNotes
          article={article}
          page={page}
          pages={pages}
          onPage={setPage}
          onSave={saveNotes}
        />
      </div>
    </div>
  );
}

function PdfReadingTools({
  settings,
  onUpdate,
}: {
  settings: ReaderSettings;
  onUpdate: (settings: Partial<ReaderSettings>) => void;
}) {
  return (
    <div className="ml-auto flex w-full items-center justify-end gap-2 sm:w-auto">
      <TTSPlayer
        getText={() => {
          const layer = document.querySelector('.react-pdf__Page__textContent');
          return layer?.textContent?.trim() ?? '';
        }}
      />
      <AppearanceToolbar settings={settings} onUpdate={onUpdate} showTypography={false} />
    </div>
  );
}

function AccountPdfNotes({
  article,
  page,
  pages,
  onPage,
  onSave,
}: {
  article: Article;
  page: number;
  pages: number;
  onPage: (page: number) => void;
  onSave: (notes: Note[], baseNotes: Note[]) => Promise<void>;
}) {
  const [showChat, setShowChat] = useState(false);
  return (
    <aside className="flex min-h-0 w-full flex-col rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)]/85 lg:w-[400px] lg:shrink-0">
      <div className="border-b border-[var(--gray-5)] p-4 overflow-y-auto">
        <p className="mb-4 text-sm text-gray-400">Notes are saved to your account.</p>
        <PdfPageNotes
          notes={article.notes ?? []}
          page={page}
          pages={pages}
          onPage={onPage}
          onSave={onSave}
          storage="account"
        />
      </div>
      <div className={showChat ? 'min-h-[24rem] flex-1 overflow-auto' : 'flex-1'}>
        {showChat ? (
          <NotesAIChat article={article} notes={article.notes ?? []} queuedPrompt={null} />
        ) : (
          <div className="p-4">
            <p className="mb-4 text-sm leading-relaxed text-gray-300">
              Ask about this PDF with your configured AI provider.
            </p>
            <Button type="button" onClick={() => setShowChat(true)}>
              Open AI chat
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
}
