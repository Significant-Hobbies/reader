'use client';

import { Brain, FileText, Globe, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  type MemoryCapture,
  type MemorySearchHit,
  searchMemoryCaptures,
} from '@/lib/memory-capture';

import { Badge } from './ui/badge';
import { Input } from './ui/input';

const KIND_ICONS = {
  web_page: Globe,
  blog_article: FileText,
  pdf_document: FileText,
} as const;

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

interface MemoryPrototypeClientProps {
  corpus: MemoryCapture[];
  demoQueries: Record<string, string>;
}

export function MemoryPrototypeClient({ corpus, demoQueries }: MemoryPrototypeClientProps) {
  const [query, setQuery] = useState(demoQueries.crossCapture ?? 'queryable');
  const hits: MemorySearchHit[] = useMemo(
    () => searchMemoryCaptures(corpus, query),
    [corpus, query]
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-start gap-3">
        <Brain className="mt-1 h-8 w-8 text-[var(--accent-11)]" />
        <div>
          <h1 className="text-2xl font-bold text-[var(--gray-12)]">Memory capture prototype</h1>
          <p className="mt-1 text-sm text-[var(--gray-10)]">
            Fixture-backed web, blog, and PDF-like captures plus a browser-memory import mock. No
            extension permissions required.
          </p>
          <p className="mt-2 text-xs text-[var(--gray-9)]">
            {corpus.length} captures loaded · try{' '}
            {Object.entries(demoQueries)
              .map(([, q]) => `"${q}"`)
              .join(', ')}
          </p>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--gray-9)]" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search captures, annotations, PDF text…"
          className="border-[var(--gray-6)] bg-[var(--gray-2)] pl-10 text-[var(--gray-12)]"
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {Object.entries(demoQueries).map(([key, q]) => (
          <button
            key={key}
            type="button"
            onClick={() => setQuery(q)}
            className="rounded-md border border-[var(--gray-6)] px-2 py-1 text-xs text-[var(--gray-11)] hover:bg-[var(--gray-3)]"
          >
            {key}: {q}
          </button>
        ))}
      </div>

      {query.trim().length < 2 ? (
        <p className="text-sm text-[var(--gray-10)]">Enter at least 2 characters to search.</p>
      ) : hits.length === 0 ? (
        <p className="text-sm text-[var(--gray-10)]">No results for &quot;{query}&quot;.</p>
      ) : (
        <ul className="space-y-4">
          {hits.map((hit) => {
            const Icon = KIND_ICONS[hit.source.kind];
            return (
              <li
                key={`${hit.captureId}-${hit.matchedFields.join('-')}`}
                className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-4"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Icon className="h-4 w-4 text-[var(--accent-11)]" />
                  <span className="font-medium text-[var(--gray-12)]">{hit.title}</span>
                  <Badge variant="secondary" className="text-xs">
                    {hit.source.kind.replace('_', ' ')}
                  </Badge>
                </div>
                <p className="text-xs text-[var(--gray-10)]">{hit.source.label}</p>
                <p className="truncate text-xs text-[var(--gray-9)]">{hit.source.url}</p>
                <p className="mt-2 text-sm text-[var(--gray-11)]">{hit.snippet}</p>
                {hit.annotationContext && (
                  <p className="mt-2 border-l-2 border-[var(--accent-6)] pl-3 text-xs text-[var(--gray-10)] italic">
                    {hit.annotationContext}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--gray-9)]">
                  <span>{formatTimestamp(hit.capturedAt)}</span>
                  <span>· matched {hit.matchedFields.join(', ')}</span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
