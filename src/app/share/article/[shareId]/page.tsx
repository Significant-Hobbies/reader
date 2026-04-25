import { notFound } from 'next/navigation';
import { fetchArticleByShareId } from '../../../../lib/articles-db';
import { ReaderCore } from '../../../../components/reader/ReaderCore';
import type { Article } from '../../../../types';

export const dynamic = 'force-dynamic';

export default async function SharedArticlePage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const article = await fetchArticleByShareId(shareId);
  if (!article) {
    notFound();
  }

  // Dummy id/userId for type compat — neither is used in read-only mode
  const readOnlyArticle: Article = {
    ...article,
    id: '',
    userId: '',
    aiChat: [],
  };

  return (
    <div className="flex h-full overflow-hidden p-4 md:p-6">
      <ReaderCore article={readOnlyArticle} readOnly />
    </div>
  );
}
