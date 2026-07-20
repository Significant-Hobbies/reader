import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { BoardSummary } from '../../../types';

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
