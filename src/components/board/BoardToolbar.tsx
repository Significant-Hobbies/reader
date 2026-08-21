'use client';

import { Bot, Check, Globe, Pencil, Share2, StickyNote } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { SaveStatus } from './hooks/useBoardAutoSave';
import { ShareDialog } from './ShareDialog';

interface AddHandlers {
  onAddNote: () => void;
  onAddWebsite: () => void;
  onAddAIChat: () => void;
}

interface BoardToolbarProps {
  boardName: string;
  onBoardNameChange: (name: string) => void;
  addHandlers: AddHandlers;
  saveStatus: SaveStatus;
  boardId: string;
  shareId?: string;
}

const STATUS_LABELS: Record<SaveStatus, string> = {
  idle: '',
  saving: 'Saving...',
  saved: 'Saved',
  error: 'Save failed',
};

function BoardNameEditor({
  boardName,
  onBoardNameChange,
}: {
  boardName: string;
  onBoardNameChange: (name: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(boardName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const commitName = () => {
    setIsEditing(false);
    onBoardNameChange(editValue);
  };

  if (isEditing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          commitName();
        }}
        className="flex items-center gap-1.5"
      >
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={commitName}
          className="w-40 bg-transparent text-sm font-semibold text-white outline-none"
          maxLength={100}
        />
        <button type="submit" className="text-gray-400 hover:text-white">
          <Check className="h-3.5 w-3.5" />
        </button>
      </form>
    );
  }

  return (
    <button
      onClick={() => {
        setEditValue(boardName);
        setIsEditing(true);
      }}
      className="flex items-center gap-1.5 text-sm font-semibold text-white transition-colors hover:text-blue-300"
    >
      {boardName}
      <Pencil className="h-3 w-3 text-gray-500" />
    </button>
  );
}

export function BoardToolbar({
  boardName,
  onBoardNameChange,
  addHandlers,
  saveStatus,
  boardId,
  shareId: initialShareId,
}: BoardToolbarProps) {
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareId, setShareId] = useState(initialShareId);

  const handleShareIdChange = useCallback((newShareId: string | undefined) => {
    setShareId(newShareId);
  }, []);

  return (
    <>
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900/90 px-3 py-1.5 shadow-lg backdrop-blur">
        <BoardNameEditor boardName={boardName} onBoardNameChange={onBoardNameChange} />

        <div className="h-4 w-px bg-gray-700" />

        <button
          onClick={() => setShowShareDialog(true)}
          className="flex items-center gap-1 text-gray-400 transition-colors hover:text-blue-300"
          title="Share"
        >
          <Share2 className="h-3.5 w-3.5" />
          {shareId && <span className="h-1.5 w-1.5 rounded-full bg-green-400" />}
        </button>

        {saveStatus !== 'idle' && (
          <>
            <div className="h-4 w-px bg-gray-700" />
            <span
              className={`text-xs ${saveStatus === 'error' ? 'text-red-400' : 'text-gray-500'}`}
            >
              {STATUS_LABELS[saveStatus]}
            </span>
          </>
        )}
      </div>

      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-gray-700 bg-gray-900/90 px-2 py-1.5 shadow-xl backdrop-blur">
        <ToolbarButton
          icon={<StickyNote className="h-4 w-4" />}
          label="Add Note"
          onClick={addHandlers.onAddNote}
        />
        <ToolbarButton
          icon={<Globe className="h-4 w-4" />}
          label="Add Source"
          onClick={addHandlers.onAddWebsite}
        />
        <ToolbarButton
          icon={<Bot className="h-4 w-4" />}
          label="Add AI Chat"
          onClick={addHandlers.onAddAIChat}
        />
      </div>

      <ShareDialog
        open={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        boardId={boardId}
        shareId={shareId}
        onShareIdChange={handleShareIdChange}
      />
    </>
  );
}

function ToolbarButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-800 hover:text-white"
      title={label}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
