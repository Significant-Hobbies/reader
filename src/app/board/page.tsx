import { redirect } from 'next/navigation';
import { dehydrate } from '@tanstack/react-query';
import { BoardListClient } from '../../components/board/BoardListClient';
import { fetchBoardSummaries } from '../../lib/boards-service';
import { ReactQueryHydrate } from '../../components/ReactQueryHydrate';
import { getQueryClient } from '../../lib/get-query-client';
import { getCurrentUser } from '../../lib/auth-server';

export const dynamic = 'force-dynamic';

export default async function BoardsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const queryClient = getQueryClient();

  await queryClient.prefetchQuery({
    queryKey: ['boards'],
    queryFn: () => fetchBoardSummaries(user.uid),
  });

  return (
    <ReactQueryHydrate state={dehydrate(queryClient)}>
      <BoardListClient />
    </ReactQueryHydrate>
  );
}
