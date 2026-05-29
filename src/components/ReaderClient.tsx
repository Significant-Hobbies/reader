'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Share2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useIsMobileViewport } from '../hooks/useIsMobileViewport';
import type { Article } from '../types';
import { Navbar } from './Navbar';
import { ArticleShareDialog } from './reader/ArticleShareDialog';
import { ReaderCore } from './reader/ReaderCore';
import { TTSPlayer } from './TTSPlayer';

export default function ReaderClient({ articleId }: { articleId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [shareOpen, setShareOpen] = useState(false);
  const isMobile = useIsMobileViewport();

  const {
    data: article,
    isLoading,
    error,
  } = useQuery<Article>({
    queryKey: ['article', articleId],
    queryFn: async () => {
      const response = await fetch(`/api/articles/${articleId}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error('NOT_FOUND');
        throw new Error('Failed to fetch article');
      }
      return response.json();
    },
    enabled: Boolean(articleId),
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#15130f]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--accent-10)]" />
          <p className="text-gray-400">Loading article...</p>
        </div>
      </div>
    );
  }

  if (error && !article) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#15130f] text-gray-200">
        <p>
          {(error as Error).message === 'NOT_FOUND'
            ? 'Document not found.'
            : 'Failed to load article.'}
        </p>
        <button
          onClick={() => router.push('/')}
          className="rounded-md bg-[var(--accent-9)] px-4 py-2 text-white transition hover:bg-[var(--accent-10)]"
        >
          Back to Library
        </button>
      </div>
    );
  }

  if (!article) return null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#15130f] bg-[radial-gradient(circle_at_top_left,rgba(180,140,92,0.10),transparent_32rem)] font-sans text-gray-100">
      <Navbar />
      <div className="flex flex-1 overflow-hidden p-2 md:p-6">
        <ReaderCore
          article={article}
          compact={isMobile}
          headerActions={
            <>
              <TTSPlayer
                compact={isMobile}
                getText={() => `${article.title?.trim() ?? ''}\n\n${article.content ?? ''}`}
              />
              <button
                onClick={() => setShareOpen(true)}
                className="rounded-md p-2 text-gray-400 transition-colors hover:bg-[var(--gray-3)] hover:text-white"
                title="Share article"
              >
                <Share2 className="h-4 w-4" />
              </button>
            </>
          }
        />
      </div>
      <ArticleShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        articleId={articleId}
        shareId={article.shareId}
        onShareIdChange={(newShareId) => {
          queryClient.setQueryData<Article>(['article', articleId], (old) =>
            old ? { ...old, shareId: newShareId } : old
          );
        }}
      />
    </div>
  );
}
