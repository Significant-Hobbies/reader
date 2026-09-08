import type { Note } from '../types';

export class NoteConflictError extends Error {
  constructor() {
    super(
      'These notes changed in another editor. Your draft is still here. Copy your changes before reloading, then compare them with the saved notes.'
    );
    this.name = 'NoteConflictError';
  }
}

const same = (left: Note | undefined, right: Note | undefined) =>
  JSON.stringify(left) === JSON.stringify(right);

/** Apply only this editor's changes; unrelated concurrent notes remain intact. */
export function mergeNoteChanges(base: Note[], next: Note[], current: Note[]): Note[] {
  const before = new Map(base.map((note) => [note.id, note]));
  const after = new Map(next.map((note) => [note.id, note]));
  const merged = new Map(current.map((note) => [note.id, note]));
  for (const id of new Set([...before.keys(), ...after.keys()])) {
    const original = before.get(id);
    const proposed = after.get(id);
    if (same(original, proposed)) continue;
    const saved = merged.get(id);
    if (!same(saved, original) && !same(saved, proposed)) throw new NoteConflictError();
    if (proposed) merged.set(id, proposed);
    else merged.delete(id);
  }
  return [...merged.values()];
}
