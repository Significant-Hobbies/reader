'use client';

import { ChevronRight, Trash2 } from 'lucide-react';
import { memo, useState } from 'react';

import type { Note } from '../../types';

interface NoteCardProps {
  note: Note;
  index: number;
  onScrollTo: (note: Note) => void;
  onDelete: (id: number) => void;
  onChange: (id: number, text: string) => void;
  readOnly?: boolean;
  isActive?: boolean;
}

export const NoteCard = memo(
  ({ note, index, onScrollTo, onDelete, onChange, readOnly, isActive }: NoteCardProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const anchorLabel =
      note.anchor && typeof note.anchor.elementIndex === 'number'
        ? `${note.anchor.tagName?.toLowerCase() || 'element'} #${note.anchor.elementIndex + 1}`
        : 'Location unavailable';

    return (
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onScrollTo(note);
          }
        }}
        className={`group rounded-lg border p-3.5 shadow-sm transition-colors ${
          isActive
            ? 'border-[var(--accent-7)] bg-[var(--accent-3)]/40'
            : 'border-[var(--gray-6)] bg-[var(--gray-3)]/50 hover:border-[var(--gray-7)] hover:bg-[var(--gray-3)]'
        }`}
        onClick={() => onScrollTo(note)}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2 rounded-md bg-[var(--gray-2)]/80 px-2 py-1 font-mono text-[11px] text-[var(--gray-11)]">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--accent-9)] text-[10px] font-bold text-[var(--accent-12)]">
              {index + 1}
            </span>
            <span className="truncate">{anchorLabel}</span>
          </span>
          <div className="flex shrink-0 items-center gap-1">
            {!readOnly && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(note.id);
                }}
                aria-label={`Delete note ${index + 1}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--gray-10)] opacity-100 transition-colors hover:bg-red-500/10 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <ChevronRight className="h-4 w-4 text-[var(--gray-9)] sm:opacity-0 sm:group-hover:opacity-100" />
          </div>
        </div>
        {note.anchor?.textPreview && (
          <p className="mb-2.5 line-clamp-2 text-xs leading-5 text-[var(--gray-10)] italic">
            &ldquo;{note.anchor.textPreview}&rdquo;
          </p>
        )}
        {!readOnly && isEditing ? (
          <textarea
            value={note.text}
            onChange={(e) => onChange(note.id, e.target.value)}
            placeholder="Write your observation..."
            rows={3}
            autoFocus
            className="min-h-[96px] w-full resize-none rounded-md border border-[var(--gray-6)] bg-[var(--gray-2)]/80 p-3 text-sm text-[var(--gray-12)] placeholder-[var(--gray-9)] transition-colors focus:border-[var(--accent-7)] focus:outline-none"
            onClick={(e) => e.stopPropagation()}
            onBlur={() => setIsEditing(false)}
          />
        ) : !readOnly ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="w-full rounded-md border border-transparent bg-[var(--gray-2)]/40 p-3 text-left transition-colors hover:border-[var(--gray-6)] hover:bg-[var(--gray-2)]/70"
          >
            <p
              className={`line-clamp-3 text-sm whitespace-pre-line ${note.text ? 'text-[var(--gray-12)]' : 'text-[var(--gray-10)] italic'}`}
            >
              {note.text || 'Tap to add your note...'}
            </p>
          </button>
        ) : (
          <div className="rounded-md bg-[var(--gray-2)]/40 p-3">
            <p
              className={`line-clamp-3 text-sm whitespace-pre-line ${note.text ? 'text-[var(--gray-12)]' : 'text-[var(--gray-10)] italic'}`}
            >
              {note.text || 'No content'}
            </p>
          </div>
        )}
      </div>
    );
  }
);
NoteCard.displayName = 'NoteCard';
