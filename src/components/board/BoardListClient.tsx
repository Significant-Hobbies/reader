'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Layout, Loader2 } from 'lucide-react';
import { useBoardList, useCreateBoard, useDeleteBoard } from './hooks/useBoardData';

export function BoardListClient() {
  const router = useRouter();
  const { data: boards, isLoading } = useBoardList();
  const createBoard = useCreateBoard();
  const deleteBoard = useDeleteBoard();
  const [newBoardName, setNewBoardName] = useState('');

  const handleCreate = async () => {
    const name = newBoardName.trim() || 'Untitled Board';
    const result = await createBoard.mutateAsync(name);
    setNewBoardName('');
    router.push(`/board/${result.id}`);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteBoard.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Boards</h1>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newBoardName}
            onChange={(e) => setNewBoardName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreate();
            }}
            placeholder="Board name..."
            className="h-9 rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-gray-100 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => void handleCreate()}
            disabled={createBoard.isPending}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
          >
            {createBoard.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            New Board
          </button>
        </div>
      </div>

      {!boards || boards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/40 p-12 text-center">
          <Layout className="mx-auto mb-3 h-10 w-10 text-gray-600" />
          <p className="text-gray-400">No boards yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {boards.map((board) => (
            <button
              key={board.id}
              onClick={() => router.push(`/board/${board.id}`)}
              className="group relative rounded-xl border border-gray-800 bg-gray-900/60 p-5 text-left transition-all hover:border-gray-700 hover:bg-gray-900/80"
            >
              <div className="mb-2 flex items-center justify-between">
                <Layout className="h-5 w-5 text-blue-400" />
                <button
                  onClick={(e) => handleDelete(e, board.id)}
                  disabled={deleteBoard.isPending}
                  className="rounded-md p-1 text-gray-500 opacity-0 transition-all hover:bg-gray-800 hover:text-red-400 group-hover:opacity-100"
                  title="Delete board"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <h3 className="mb-1 font-semibold text-gray-100 truncate">{board.name}</h3>
              <p className="text-xs text-gray-500">
                {board.nodeCount} {board.nodeCount === 1 ? 'node' : 'nodes'}
                {board.updatedAt && <> &middot; {new Date(board.updatedAt).toLocaleDateString()}</>}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
