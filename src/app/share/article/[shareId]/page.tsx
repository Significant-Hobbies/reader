import { notFound } from 'next/navigation';

import { SharedArticleReader } from '../../../../components/reader/SharedArticleReader';
import { fetchArticleByShareId } from '../../../../lib/articles-db';
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

  return <SharedArticleReader article={readOnlyArticle} />;
}
