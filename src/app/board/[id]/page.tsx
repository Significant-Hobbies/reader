import { dehydrate } from '@tanstack/react-query';
import { notFound, redirect } from 'next/navigation';

import { BoardCanvasClient } from '../../../components/board/BoardCanvasClient';
import { ReactQueryHydrate } from '../../../components/ReactQueryHydrate';
import { getCurrentUser } from '../../../lib/auth-server';
import { fetchBoardById } from '../../../lib/boards-db';
import { getQueryClient } from '../../../lib/get-query-client';

export const dynamic = 'force-dynamic';

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const { id } = await params;
  const queryClient = getQueryClient();

  const board = await fetchBoardById(id, user.id);
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
