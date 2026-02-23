import { notFound } from 'next/navigation';
import { BoardCanvasClient } from '../../../components/board/BoardCanvasClient';
import { fetchBoardByShareId } from '../../../lib/boards-service';
import type { Board } from '../../../types';

export const dynamic = 'force-dynamic';

export default async function SharedBoardPage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const board = await fetchBoardByShareId(shareId);
  if (!board) {
    notFound();
  }

  // Cast to Board with a dummy userId (stripped from response, only needed for type compat)
  const readOnlyBoard: Board = { ...board, userId: '' };

  return <BoardCanvasClient board={readOnlyBoard} readOnly />;
}
