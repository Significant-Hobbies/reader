'use client';

import { memo, useState } from 'react';

import type { Note } from '../../types';

interface NoteCardProps {
  note: Note;
  index: number;
  onScrollTo: (note: Note) => void;
  onDelete: (id: number) => void;
  onChange: (id: number, text: string) => void;
  readOnly?: boolean;
}

export const NoteCard = memo(
  ({ note, index, onScrollTo, onDelete, onChange, readOnly }: NoteCardProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const anchorLabel =
      note.anchor && typeof note.anchor.elementIndex === 'number'
        ? `${note.anchor.tagName?.toLowerCase() || 'element'} #${note.anchor.elementIndex + 1}`
        : 'Location unavailable';

    return (
      <div
        className="group rounded-xl border border-gray-700 bg-gray-800 p-4 shadow-sm transition-colors hover:border-gray-600"
        onClick={() => onScrollTo(note)}
      >
        <div className="mb-2 flex items-start justify-between">
          <span className="flex items-center gap-2 rounded bg-gray-900/50 px-2 py-1 font-mono text-xs text-gray-400">
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-[10px] font-bold text-yellow-900">
              {index + 1}
            </span>
            {anchorLabel}
          </span>
          {!readOnly && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(note.id);
              }}
              className="text-gray-500 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
            >
              Delete
            </button>
          )}
        </div>
        {note.anchor?.textPreview && (
          <p className="mb-3 overflow-hidden text-xs text-ellipsis whitespace-nowrap text-gray-500 italic">
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
            className="min-h-[120px] w-full resize-none rounded-md bg-gray-900/60 p-3 text-gray-200 placeholder-gray-600 transition-colors focus:outline-none"
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
            className="w-full rounded-md bg-gray-900/30 p-3 text-left transition-colors hover:bg-gray-900/60"
          >
            <p
              className={`max-h-[4.5rem] overflow-hidden text-sm whitespace-pre-line ${note.text ? 'text-gray-200' : 'text-gray-500 italic'}`}
            >
              {note.text || 'Click to write your observation...'}
            </p>
          </button>
        ) : (
          <div className="rounded-md bg-gray-900/30 p-3">
            <p
              className={`max-h-[4.5rem] overflow-hidden text-sm whitespace-pre-line ${note.text ? 'text-gray-200' : 'text-gray-500 italic'}`}
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
