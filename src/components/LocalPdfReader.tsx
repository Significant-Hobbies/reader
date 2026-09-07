import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Article, Note } from '../types';
import { Navbar } from './Navbar';
import { PDFViewer } from './PDFViewer';
import { Button } from './ui/button';

export function LocalPdfReader({
  article,
  onSave,
}: {
  article: Article;
  onSave: (notes: Note[]) => Promise<void>;
}) {
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<Note | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const notes = article.notes ?? [];
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
      setMessage('Saved in this browser.');
    } catch {
      setError(
        'Could not save this change. Your draft is still here. Check browser storage and retry.'
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
    <div className="min-h-screen bg-[#15130f] font-sans text-gray-100">
      <Navbar />
      <main className="p-4 md:p-6">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--gray-5)] pb-4">
          <div className="min-w-0">
            <Link
              to="/library"
              className="inline-flex min-h-11 items-center text-sm text-[var(--accent-11)] underline"
            >
              Back to library
            </Link>
            <h1 className="mt-2 break-words text-2xl font-semibold">{article.title}</h1>
            <p className="mt-1 text-sm text-gray-400">
              Local PDF · Document and notes stay in this browser.
            </p>
          </div>
        </header>
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <section
            aria-label="PDF pages"
            className="min-w-0 overflow-auto rounded-lg border border-[var(--gray-5)] lg:max-h-[calc(100vh-12rem)]"
          >
            <PDFViewer
              pdfUrl={article.pdfUrl!}
              settings={{ fontSize: 'medium', theme: 'dark', fontFamily: 'sans' }}
              page={page}
              onPageChange={setPage}
              onDocumentLoad={setPages}
            />
          </section>
          <aside
            aria-label="Page notes"
            className="min-w-0 lg:max-h-[calc(100vh-12rem)] lg:overflow-y-auto"
          >
            <h2 className="text-xl font-semibold">Page notes</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              Attach your thoughts to a page. These are page references, not text highlights, and
              are not embedded in the PDF.
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
              onPage={(target) => setPage(Math.min(pages, target))}
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
          </aside>
        </div>
      </main>
    </div>
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
