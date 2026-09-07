import { useState } from 'react';
import type { Note } from '../types';
import { Button } from './ui/button';

export function PdfPageNotes({
  notes,
  page,
  pages,
  onPage,
  onSave,
  storage,
}: {
  notes: Note[];
  page: number;
  pages: number;
  onPage: (page: number) => void;
  onSave: (notes: Note[]) => Promise<void>;
  storage: 'browser' | 'account';
}) {
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const anchorPage = editing?.anchor?.pageNumber ?? page;

  async function persist(next: Note[], clearDraft: boolean) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await onSave(next);
      if (clearDraft) {
        setDraft('');
        setEditing(null);
      }
      setMessage(storage === 'browser' ? 'Saved in this browser.' : 'Saved to your account.');
    } catch {
      setError(
        storage === 'browser'
          ? 'Could not save this change. Your draft is still here. Check browser storage and retry.'
          : 'Could not save this change. Your draft is still here. Check your connection and retry.'
      );
    } finally {
      setBusy(false);
    }
  }

  function save() {
    if (!draft.trim() || busy || !pages) return;
    const note: Note = {
      id: editing?.id ?? Math.max(Date.now(), ...notes.map((item) => item.id + 1)),
      text: draft.trim(),
      anchor: { elementIndex: anchorPage - 1, pageNumber: anchorPage },
    };
    void persist(
      editing ? notes.map((item) => (item.id === editing.id ? note : item)) : [...notes, note],
      true
    );
  }

  return (
    <>
      <h2 className="text-xl font-semibold">Page notes</h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-400">
        Attach your thoughts to a page. These are page references, not text highlights, and are not
        embedded in the PDF.
      </p>
      <form
        className="mt-5 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <label htmlFor="pdf-page-note" className="block text-sm font-medium">
          Page note <span className="text-gray-400">· page {anchorPage}</span>
        </label>
        <textarea
          id="pdf-page-note"
          aria-label="Page note"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setMessage('');
          }}
          disabled={busy}
          rows={4}
          maxLength={10000}
          placeholder="What is useful on this page?"
          className="w-full resize-y rounded-md border border-[var(--gray-6)] bg-[var(--gray-2)] p-3 text-base text-gray-100 placeholder:text-gray-400 focus:outline-2 focus:outline-[var(--accent-9)]"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy || !draft.trim() || !pages}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Save note'}
          </Button>
          {editing && (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setEditing(null);
                setDraft('');
                setError('');
              }}
            >
              Cancel edit
            </Button>
          )}
        </div>
        <p role="status" className="min-h-5 text-sm text-gray-300">
          {message}
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}
      </form>
      <PdfNoteList
        notes={notes}
        disabled={busy || !pages}
        onPage={(target) => onPage(Math.min(pages, target))}
        onEdit={(note) => {
          setEditing(note);
          setDraft(note.text);
          setError('');
          setMessage('');
        }}
        onDelete={(note) =>
          void persist(
            notes.filter((item) => item.id !== note.id),
            editing?.id === note.id
          )
        }
      />
    </>
  );
}

function PdfNoteList({
  notes,
  disabled,
  onPage,
  onEdit,
  onDelete,
}: {
  notes: Note[];
  disabled: boolean;
  onPage: (page: number) => void;
  onEdit: (note: Note) => void;
  onDelete: (note: Note) => void;
}) {
  return (
    <div className="mt-4 divide-y divide-[var(--gray-5)] border-t border-[var(--gray-5)]">
      {notes.length === 0 && <p className="py-5 text-sm text-gray-400">No page notes yet.</p>}
      {notes.map((note) => (
        <article key={note.id} className="py-5">
          <button
            type="button"
            aria-label={`Go to page ${note.anchor?.pageNumber ?? 1}`}
            disabled={disabled}
            onClick={() => onPage(note.anchor?.pageNumber ?? 1)}
            className="min-h-11 text-sm font-medium text-[var(--accent-11)] underline disabled:opacity-50"
          >
            Page {note.anchor?.pageNumber ?? 1}
          </button>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
            {note.text}
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={disabled}
              onClick={() => onEdit(note)}
            >
              Edit note
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={disabled}
              onClick={() => onDelete(note)}
            >
              Delete note
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
