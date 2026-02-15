'use client';

import { StickyNote, Globe, Bot } from 'lucide-react';
import type { SaveStatus } from './hooks/useBoardAutoSave';

interface BoardToolbarProps {
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
  onAddNote,
  onAddWebsite,
  onAddAIChat,
  saveStatus,
}: BoardToolbarProps) {
  return (
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
      <ToolbarButton icon={<Bot className="h-4 w-4" />} label="Add AI Chat" onClick={onAddAIChat} />

      {saveStatus !== 'idle' && (
        <>
          <div className="mx-1 h-5 w-px bg-gray-700" />
          <span
            className={`px-2 text-xs ${saveStatus === 'error' ? 'text-red-400' : 'text-gray-500'}`}
          >
            {STATUS_LABELS[saveStatus]}
          </span>
        </>
      )}
    </div>
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
