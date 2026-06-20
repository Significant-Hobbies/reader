import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { SharedArticleReader } from '@/components/reader/SharedArticleReader';
import type { Article } from '@/types';

export default function SharedArticlePage() {
  const { shareId } = useParams<{ shareId: string }>();

  const {
    data: article,
    isLoading,
    error,
  } = useQuery<Article>({
    queryKey: ['shared-article', shareId],
    queryFn: async () => {
      const response = await fetch(`/api/share/article/${shareId}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error('NOT_FOUND');
        throw new Error('Failed to fetch article');
      }
      return response.json();
    },
    enabled: Boolean(shareId),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#15130f] text-gray-400">
        Loading shared article…
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#15130f] text-gray-200">
        <p>Shared article not found.</p>
        <Link to="/" className="rounded-md border px-4 py-2 hover:opacity-80">
          Home
        </Link>
      </div>
    );
  }

  const readOnlyArticle: Article = {
    ...article,
    id: '',
    userId: '',
    aiChat: [],
  };

  return <SharedArticleReader article={readOnlyArticle} />;
}
