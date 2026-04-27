'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Share2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { Article } from '../types';
import { Navbar } from './Navbar';
import { ArticleShareDialog } from './reader/ArticleShareDialog';
import { ReaderCore } from './reader/ReaderCore';

export default function ReaderClient({ articleId }: { articleId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [shareOpen, setShareOpen] = useState(false);

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
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500" />
          <p className="text-gray-400">Loading article...</p>
        </div>
      </div>
    );
  }

  if (error && !article) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-900 text-gray-200">
        <p>
          {(error as Error).message === 'NOT_FOUND'
            ? 'Document not found.'
            : 'Failed to load article.'}
        </p>
        <button
          onClick={() => router.push('/')}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-500"
        >
          Back to Library
        </button>
      </div>
    );
  }

  if (!article) return null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-gradient-to-b from-black via-gray-950 to-gray-900 font-sans text-gray-100">
      <Navbar />
      <div className="flex flex-1 overflow-hidden p-4 md:p-6">
        <ReaderCore
          article={article}
          headerActions={
            <button
              onClick={() => setShareOpen(true)}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
              title="Share article"
            >
              <Share2 className="h-4 w-4" />
            </button>
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
