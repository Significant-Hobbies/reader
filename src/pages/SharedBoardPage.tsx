import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';

import { BoardCanvasClient } from '@/components/board/BoardCanvasClient';
import type { Board } from '@/types';

export default function SharedBoardPage() {
  const { shareId } = useParams<{ shareId: string }>();

  const {
    data: board,
    isLoading,
    error,
  } = useQuery<Board>({
    queryKey: ['shared-board', shareId],
    queryFn: async () => {
      const response = await fetch(`/api/share/${shareId}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error('NOT_FOUND');
        throw new Error('Failed to fetch board');
      }
      return response.json();
    },
    enabled: Boolean(shareId),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#15130f] text-gray-400">
        Loading shared board…
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#15130f] text-gray-200">
        <p>Shared board not found.</p>
        <Link to="/" className="rounded-md border px-4 py-2 hover:opacity-80">
          Home
        </Link>
      </div>
    );
  }

  const readOnlyBoard: Board = { ...board, id: '', userId: '' };
  return <BoardCanvasClient board={readOnlyBoard} readOnly />;
}
