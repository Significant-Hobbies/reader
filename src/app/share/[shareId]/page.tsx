import { notFound } from 'next/navigation';
import { BoardCanvasClient } from '../../../components/board/BoardCanvasClient';
import { fetchBoardByShareId } from '../../../lib/boards-db';
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

  // Dummy id/userId for type compat — neither is used in read-only mode
  const readOnlyBoard: Board = { ...board, id: '', userId: '' };

  return <BoardCanvasClient board={readOnlyBoard} readOnly />;
}
