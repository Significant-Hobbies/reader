'use client';

import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

import type { ReaderSettings } from '../types';
import { getThemeClasses } from './ReaderView';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  pdfUrl: string;
  settings: ReaderSettings;
}

export function PDFViewer({ pdfUrl, settings }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const themeClasses = getThemeClasses(settings.theme);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setIsLoading(false);
    setError(null);
  }

  function onDocumentLoadError(error: Error) {
    console.error('Error loading PDF:', error);
    setError('Failed to load PDF. Please try again.');
    setIsLoading(false);
  }

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(numPages || 1, prev + 1));
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(2.5, prev + 0.2));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(0.5, prev - 0.2));
  };

  const resetZoom = () => {
    setScale(1.0);
  };

  return (
    <div className={`min-h-full transition-colors duration-300 ${themeClasses}`}>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)]/80 p-4">
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrevPage}
              disabled={pageNumber <= 1}
              className="rounded-md bg-[var(--accent-9)] px-3 py-2 text-white transition hover:bg-[var(--accent-10)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="min-w-[120px] text-center text-sm text-[var(--gray-11)]">
              Page {pageNumber} of {numPages || '...'}
            </span>
            <button
              onClick={goToNextPage}
              disabled={!numPages || pageNumber >= numPages}
              className="rounded-md bg-[var(--accent-9)] px-3 py-2 text-white transition hover:bg-[var(--accent-10)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={zoomOut}
              className="rounded-md border border-[var(--gray-6)] bg-[var(--gray-3)] px-3 py-2 text-[var(--gray-12)] transition hover:bg-[var(--gray-4)]"
              title="Zoom out"
            >
              -
            </button>
            <button
              onClick={resetZoom}
              className="min-w-[60px] rounded-md border border-[var(--gray-6)] bg-[var(--gray-3)] px-3 py-2 text-sm text-[var(--gray-12)] transition hover:bg-[var(--gray-4)]"
              title="Reset zoom"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              onClick={zoomIn}
              className="rounded-md border border-[var(--gray-6)] bg-[var(--gray-3)] px-3 py-2 text-[var(--gray-12)] transition hover:bg-[var(--gray-4)]"
              title="Zoom in"
            >
              +
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--accent-10)]"></div>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg border border-red-700 bg-red-900/50 px-6 py-4 text-red-200">
            {error}
          </div>
        )}

        <div className="flex justify-center">
          <Document
            key={pdfUrl}
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex items-center justify-center py-20">
                <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-[var(--accent-10)]"></div>
              </div>
            }
            className="pdf-document"
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="shadow-2xl"
            />
          </Document>
        </div>

        <style jsx global>{`
          .pdf-document {
            display: flex;
            justify-content: center;
          }
          .react-pdf__Page {
            margin: 0 auto;
          }
          .react-pdf__Page__canvas {
            max-width: 100%;
            height: auto !important;
          }
          .react-pdf__Page__textContent {
            border: 1px solid rgba(0, 0, 0, 0.1);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          }
        `}</style>
      </div>
    </div>
  );
}
