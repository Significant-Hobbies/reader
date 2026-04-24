'use client';

import { memo, useState } from 'react';
import { Note } from '../../types';

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
        className="bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-700 hover:border-gray-600 transition-colors group"
        onClick={() => onScrollTo(note)}
      >
        <div className="flex justify-between items-start mb-2">
          <span className="text-xs font-mono text-gray-400 bg-gray-900/50 px-2 py-1 rounded flex items-center gap-2">
            <span className="w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center text-[10px] text-yellow-900 font-bold">
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
              className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Delete
            </button>
          )}
        </div>
        {note.anchor?.textPreview && (
          <p className="text-xs text-gray-500 mb-3 italic overflow-hidden text-ellipsis whitespace-nowrap">
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
            className="w-full p-3 text-gray-200 bg-gray-900/60 resize-none focus:outline-none rounded-md transition-colors placeholder-gray-600 min-h-[120px]"
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
            className="w-full text-left bg-gray-900/30 hover:bg-gray-900/60 transition-colors rounded-md p-3"
          >
            <p
              className={`text-sm whitespace-pre-line overflow-hidden max-h-[4.5rem] ${note.text ? 'text-gray-200' : 'text-gray-500 italic'}`}
            >
              {note.text || 'Click to write your observation...'}
            </p>
          </button>
        ) : (
          <div className="bg-gray-900/30 rounded-md p-3">
            <p
              className={`text-sm whitespace-pre-line overflow-hidden max-h-[4.5rem] ${note.text ? 'text-gray-200' : 'text-gray-500 italic'}`}
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
