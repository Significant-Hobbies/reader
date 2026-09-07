import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Article, Note } from '../types';
import { Navbar } from './Navbar';
import { PDFViewer } from './PDFViewer';
import { PdfPageNotes } from './PdfPageNotes';

export function LocalPdfReader({
  article,
  onSave,
}: {
  article: Article;
  onSave: (notes: Note[]) => Promise<void>;
}) {
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);

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
            <PdfPageNotes
              notes={article.notes ?? []}
              page={page}
              pages={pages}
              onPage={setPage}
              onSave={onSave}
              storage="browser"
            />
          </aside>
        </div>
      </main>
    </div>
  );
}
