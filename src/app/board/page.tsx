import { dehydrate } from '@tanstack/react-query';
import { redirect } from 'next/navigation';

import { BoardListClient } from '../../components/board/BoardListClient';
import { ReactQueryHydrate } from '../../components/ReactQueryHydrate';
import { getCurrentUser } from '../../lib/auth-server';
import { fetchBoardSummaries } from '../../lib/boards-db';
import { getQueryClient } from '../../lib/get-query-client';

export const dynamic = 'force-dynamic';

export default async function BoardsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: ['boards'],
    queryFn: () => fetchBoardSummaries(user.id),
  });

  return (
    <ReactQueryHydrate state={dehydrate(queryClient)}>
      <BoardListClient />
    </ReactQueryHydrate>
  );
}
