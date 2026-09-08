import { describe, expect, it } from 'vitest';
import { mergeNoteChanges, NoteConflictError } from '../note-merge';

const original = { id: 1, text: 'Original' };
const edited = { id: 1, text: 'Edited' };
const independent = { id: 2, text: 'Independent' };

describe('three-way note changes', () => {
  it('retains independent additions and edits, including after a lost acknowledgement', () => {
    const current = [original, independent];
    const saved = mergeNoteChanges([original], [edited], current);
    expect(saved).toEqual([edited, independent]);
    expect(mergeNoteChanges([original], [edited], saved)).toEqual(saved);
    expect(current).toEqual([original, independent]);
  });

  it('does not resurrect a concurrently deleted note that this editor did not change', () => {
    expect(mergeNoteChanges([original], [original, independent], [])).toEqual([independent]);
  });

  it('deletes only the intended note, and retries deletion safely', () => {
    expect(mergeNoteChanges([original], [], [original, independent])).toEqual([independent]);
    expect(mergeNoteChanges([original], [], [independent])).toEqual([independent]);
  });

  it('rejects conflicting edits, edit/delete races, and colliding new IDs', () => {
    expect(() => mergeNoteChanges([original], [edited], [{ id: 1, text: 'Other edit' }])).toThrow(
      NoteConflictError
    );
    expect(() => mergeNoteChanges([original], [edited], [])).toThrow(NoteConflictError);
    expect(() => mergeNoteChanges([original], [], [edited])).toThrow(NoteConflictError);
    expect(() => mergeNoteChanges([], [original], [edited])).toThrow(NoteConflictError);
  });

  it('treats an anchor move as an edit and preserves note provenance', () => {
    const base = { ...original, sourceKey: 'board-node', anchor: { elementIndex: 0 } };
    const moved = { ...base, anchor: { elementIndex: 2 } };
    expect(mergeNoteChanges([base], [moved], [base, independent])).toEqual([moved, independent]);
    expect(() => mergeNoteChanges([base], [moved], [{ ...base, text: 'Other edit' }])).toThrow(
      NoteConflictError
    );
  });
});
