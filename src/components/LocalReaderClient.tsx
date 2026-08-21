'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useIsMobileViewport } from '../hooks/useIsMobileViewport';
import { getLocalArticle, updateLocalArticle } from '../lib/local-library';
import type { Article } from '../types';
import { Navbar } from './Navbar';
import { ReaderCore } from './reader/ReaderCore';

function LoadingState() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#15130f]">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--accent-10)]" />
        <p className="text-gray-400">Loading local item...</p>
      </div>
    </div>
  );
}

function NotFoundState({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#15130f] text-gray-200">
      <p>Local item not found.</p>
      <button
        onClick={onBack}
        className="rounded-md bg-[var(--accent-9)] px-4 py-2 text-white transition hover:bg-[var(--accent-10)]"
      >
        Back to Library
      </button>
    </div>
  );
}

function LinkArticleView({ article }: { article: Article }) {
  return (
    <div className="flex h-screen flex-col bg-[#15130f] font-sans text-gray-100">
      <Navbar />
      <main className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-lg rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-8">
          <p className="text-sm font-medium text-[var(--accent-11)] uppercase">
            Saved outside link
          </p>
          <h1 className="mt-2 text-3xl font-semibold">{article.title}</h1>
          <p className="mt-3 text-sm break-all text-gray-400">{article.url}</p>
          <a
            href={article.url}
            target="_blank"
            rel="noreferrer"
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-[var(--accent-9)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-10)]"
          >
            <ExternalLink className="h-4 w-4" />
            Open original
          </a>
        </div>
      </main>
    </div>
  );
}

function PdfArticleView({ article }: { article: Article }) {
  return (
    <div className="flex h-screen flex-col bg-[#15130f] font-sans text-gray-100">
      <Navbar />
      <main className="flex flex-1 flex-col gap-4 overflow-hidden p-4 md:p-6">
        <div className="flex items-center justify-between rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] px-4 py-3">
          <div>
            <p className="text-xs font-medium text-[var(--accent-11)] uppercase">Local PDF</p>
            <h1 className="text-xl font-semibold">{article.title}</h1>
          </div>
          <a
            href={article.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-[var(--gray-6)] px-3 py-1.5 text-sm text-[var(--gray-12)] hover:bg-[var(--gray-3)]"
          >
            Open
          </a>
        </div>
        <iframe
          title={article.title}
          src={article.pdfUrl}
          className="min-h-0 flex-1 rounded-lg border border-[var(--gray-5)] bg-white"
        />
      </main>
    </div>
  );
}

export default function LocalReaderClient({ articleId }: { articleId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobileViewport();

  const {
    data: article,
    isLoading,
    error,
  } = useQuery<Article | null>({
    queryKey: ['article', articleId, 'local'],
    queryFn: () => getLocalArticle(articleId),
  });

  if (isLoading) return <LoadingState />;

  if (error || !article) return <NotFoundState onBack={() => navigate('/library')} />;

  if (article.type === 'link') return <LinkArticleView article={article} />;

  if (article.type === 'pdf' && article.pdfUrl) return <PdfArticleView article={article} />;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#15130f] font-sans text-gray-100">
      <Navbar />
      <div className="flex flex-1 overflow-hidden p-4 md:p-6">
        <ReaderCore
          article={article}
          localMode
          compact={isMobile}
          handlers={{
            onArticleChange: async (patch) => {
              const updated = await updateLocalArticle(article.id, patch);
              queryClient.setQueryData(['article', articleId, 'local'], updated);
              queryClient.invalidateQueries({ queryKey: ['articles'] });
            },
          }}
        />
      </div>
    </div>
  );
}
