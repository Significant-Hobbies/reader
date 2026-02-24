'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Navbar } from './Navbar';
import { ReaderCore } from './reader/ReaderCore';
import type { Article } from '../types';

export default function ReaderClient({ articleId }: { articleId: string }) {
  const router = useRouter();

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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading article...</p>
        </div>
      </div>
    );
  }

  if (error && !article) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-900 text-gray-200 gap-4">
        <p>
          {(error as Error).message === 'NOT_FOUND'
            ? 'Document not found.'
            : 'Failed to load article.'}
        </p>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition"
        >
          Back to Library
        </button>
      </div>
    );
  }

  if (!article) return null;

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-black via-gray-950 to-gray-900 font-sans text-gray-100 overflow-hidden">
      <Navbar />
      <div className="flex flex-1 overflow-hidden p-4 md:p-6">
        <ReaderCore article={article} />
      </div>
    </div>
  );
}
