import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { BoardCanvasClient } from '@/components/board/BoardCanvasClient';
import { useAuth } from '@/components/AuthProvider';
import type { Board } from '@/types';

export default function BoardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, user, navigate]);

  const {
    data: board,
    isLoading,
    error,
  } = useQuery<Board>({
    queryKey: ['board', id],
    queryFn: async () => {
      const response = await fetch(`/api/boards/${id}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error('NOT_FOUND');
        throw new Error('Failed to fetch board');
      }
      return response.json();
    },
    enabled: Boolean(id && user),
  });

  if (authLoading || (user && isLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#15130f] text-gray-400">
        Loading board…
      </div>
    );
  }

  if (!user || !id) {
    return null;
  }

  if (error && !board) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#15130f] text-gray-200">
        <p>Board not found.</p>
        <Link to="/board" className="rounded-md bg-[var(--accent-9)] px-4 py-2 text-white">
          Back to Boards
        </Link>
      </div>
    );
  }

  if (!board) {
    return null;
  }

  return <BoardCanvasClient board={board} />;
}
