import { redirect, notFound } from 'next/navigation';
import { dehydrate } from '@tanstack/react-query';
import { BoardCanvasClient } from '../../../components/board/BoardCanvasClient';
import { fetchBoardById } from '../../../lib/boards-service';
import { ReactQueryHydrate } from '../../../components/ReactQueryHydrate';
import { getQueryClient } from '../../../lib/get-query-client';
import { getCurrentUser } from '../../../lib/auth-server';

export const dynamic = 'force-dynamic';

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const { id } = await params;
  const queryClient = getQueryClient();

  const board = await fetchBoardById(id, user.uid);
  if (!board) {
    notFound();
  }

  queryClient.setQueryData(['board', id], board);

  return (
    <ReactQueryHydrate state={dehydrate(queryClient)}>
      <BoardCanvasClient board={board} />
    </ReactQueryHydrate>
  );
}
