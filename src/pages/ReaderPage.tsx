import { useQuery } from '@tanstack/react-query';
import { lazy, Suspense, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { useAuth } from '@/components/AuthProvider';
import type { Article } from '@/types';

const LocalReaderClient = lazy(() => import('@/components/LocalReaderClient'));
const PDFReaderClient = lazy(() => import('@/components/PDFReaderClient'));
const ReaderClient = lazy(() => import('@/components/ReaderClient'));

function ReaderLoading() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#15130f]">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--accent-10)]" />
        <p className="text-gray-400">Loading reader…</p>
      </div>
    </div>
  );
}

export default function ReaderPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const isLocalArticle = Boolean(id?.startsWith('local-'));

  useEffect(() => {
    if (!authLoading && !user && id && !isLocalArticle) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, user, id, isLocalArticle, navigate]);

  const {
    data: article,
    isLoading,
    error,
  } = useQuery<Article>({
    queryKey: ['article', id],
    queryFn: async () => {
      const response = await fetch(`/api/articles/${id}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error('NOT_FOUND');
        throw new Error('Failed to fetch article');
      }
      return response.json();
    },
    enabled: Boolean(id && user),
  });

  useEffect(() => {
    if (article?.type === 'link' && article.url) {
      window.location.replace(article.url);
    }
  }, [article]);

  if (!id) {
    return null;
  }

  if (isLocalArticle) {
    return (
      <Suspense fallback={<ReaderLoading />}>
        <LocalReaderClient articleId={id} />
      </Suspense>
    );
  }

  if (authLoading || (user && isLoading)) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#15130f]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--accent-10)]" />
          <p className="text-gray-400">Loading article...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (error && !article) {
    const message =
      (error as Error).message === 'NOT_FOUND' ? 'Document not found.' : 'Failed to load article.';
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-[#15130f] text-gray-200">
        <p>{message}</p>
        <Link
          to="/library"
          className="rounded-md bg-[var(--accent-9)] px-4 py-2 text-white transition hover:bg-[var(--accent-10)]"
        >
          Back to Library
        </Link>
      </div>
    );
  }

  if (!article) {
    return null;
  }

  if (article.type === 'link') {
    return (
      <div className="flex h-screen items-center justify-center bg-[#15130f] text-gray-400">
        Redirecting…
      </div>
    );
  }

  return (
    <Suspense fallback={<ReaderLoading />}>
      {article.type === 'pdf' ? (
        <PDFReaderClient articleId={id} />
      ) : (
        <ReaderClient articleId={id} />
      )}
    </Suspense>
  );
}
