'use client';

import { useState, useRef, useEffect } from 'react';
import { StickyNote, Globe, Bot, Pencil, Check } from 'lucide-react';
import type { SaveStatus } from './hooks/useBoardAutoSave';

interface BoardToolbarProps {
  boardName: string;
  onBoardNameChange: (name: string) => void;
  onAddNote: () => void;
  onAddWebsite: () => void;
  onAddAIChat: () => void;
  saveStatus: SaveStatus;
}

const STATUS_LABELS: Record<SaveStatus, string> = {
  idle: '',
  saving: 'Saving...',
  saved: 'Saved',
  error: 'Save failed',
};

export function BoardToolbar({
  boardName,
  onBoardNameChange,
  onAddNote,
  onAddWebsite,
  onAddAIChat,
  saveStatus,
}: BoardToolbarProps) {
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

  return (
    <>
      {/* Board name - top left */}
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900/90 px-3 py-1.5 shadow-lg backdrop-blur">
        {isEditing ? (
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
        ) : (
          <button
            onClick={() => {
              setEditValue(boardName);
              setIsEditing(true);
            }}
            className="flex items-center gap-1.5 text-sm font-semibold text-white hover:text-blue-300 transition-colors"
          >
            {boardName}
            <Pencil className="h-3 w-3 text-gray-500" />
          </button>
        )}

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

      {/* Add tools - bottom center */}
      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-gray-700 bg-gray-900/90 px-2 py-1.5 shadow-xl backdrop-blur">
        <ToolbarButton
          icon={<StickyNote className="h-4 w-4" />}
          label="Add Note"
          onClick={onAddNote}
        />
        <ToolbarButton
          icon={<Globe className="h-4 w-4" />}
          label="Add Website"
          onClick={onAddWebsite}
        />
        <ToolbarButton
          icon={<Bot className="h-4 w-4" />}
          label="Add AI Chat"
          onClick={onAddAIChat}
        />
      </div>
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
