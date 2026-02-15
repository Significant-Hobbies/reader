import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Board, BoardSummary } from '../../../types';

export function useBoardList() {
  return useQuery<BoardSummary[]>({
    queryKey: ['boards'],
    queryFn: async () => {
      const response = await fetch('/api/boards');
      if (!response.ok) {
        const err = new Error('Failed to fetch boards');
        (err as Error & { status: number }).status = response.status;
        throw err;
      }
      return response.json();
    },
  });
}

export function useBoard(id: string) {
  return useQuery<Board>({
    queryKey: ['board', id],
    queryFn: async () => {
      const response = await fetch(`/api/boards/${id}`);
      if (!response.ok) {
        const err = new Error('Failed to fetch board');
        (err as Error & { status: number }).status = response.status;
        throw err;
      }
      return response.json();
    },
    enabled: Boolean(id),
  });
}

export function useCreateBoard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch('/api/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error('Failed to create board');
      return response.json() as Promise<{ id: string }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
  });
}

export function useDeleteBoard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/boards/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete board');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
  });
}
