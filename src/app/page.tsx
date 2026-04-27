import { dehydrate } from '@tanstack/react-query';
import { redirect } from 'next/navigation';

import HomeClient from '../components/HomeClient';
import { ReactQueryHydrate } from '../components/ReactQueryHydrate';
import { fetchArticleSummaries } from '../lib/articles-db';
import { getCurrentUser } from '../lib/auth-server';
import { getQueryClient } from '../lib/get-query-client';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: ['articles'],
    queryFn: () => fetchArticleSummaries(user.id),
  });

  return (
    <ReactQueryHydrate state={dehydrate(queryClient)}>
      <HomeClient />
    </ReactQueryHydrate>
  );
}
