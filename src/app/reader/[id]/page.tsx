import { dehydrate } from '@tanstack/react-query';
import { redirect } from 'next/navigation';
import { notFound } from 'next/navigation';

import PDFReaderClient from '../../../components/PDFReaderClient';
import { ReactQueryHydrate } from '../../../components/ReactQueryHydrate';
import ReaderClient from '../../../components/ReaderClient';
import { fetchArticleById } from '../../../lib/articles-db';
import { getCurrentUser } from '../../../lib/auth-server';
import { getQueryClient } from '../../../lib/get-query-client';

export const dynamic = 'force-dynamic';

export default async function ReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const { id } = await params;
  const queryClient = getQueryClient();

  const article = await fetchArticleById(id, user.id);
  if (!article) {
    notFound();
  }

  queryClient.setQueryData(['article', id], article);

  const isPDF = article.type === 'pdf';

  return (
    <ReactQueryHydrate state={dehydrate(queryClient)}>
      {isPDF ? <PDFReaderClient articleId={id} /> : <ReaderClient articleId={id} />}
    </ReactQueryHydrate>
  );
}
