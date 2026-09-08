import type { Note } from '../types';
import { NoteConflictError } from './note-merge';

export async function saveAccountNotes(
  id: string,
  baseNotes: Note[],
  notes: Note[]
): Promise<Note[]> {
  const response = await fetch(`/api/articles/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseNotes, notes }),
  });
  if (response.status === 409) throw new NoteConflictError();
  if (!response.ok)
    throw new Error(
      'Could not save notes. Your draft is still here. Check your connection and retry.'
    );
  const result = await response.json();
  return result.notes;
}
