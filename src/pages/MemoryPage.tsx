'use client';

import { useQuery } from '@tanstack/react-query';
import { Brain, ExternalLink, Loader2, Search, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';

import { formatDate } from '@/lib/utils';
import type { Memory } from '@/lib/memories-db';
import type { SearchResult } from '@/types';
import { useAuth } from '@/components/AuthProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status}`);
  return (await res.json()) as T;
}

async function deleteMemory(id: string): Promise<void> {
  const res = await fetch(`/api/memories/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`${res.status}`);
}

export default function MemoryPage() {
  const { user, loading: authLoading } = useAuth();
  const [query, setQuery] = useState('');

  const listQuery = useQuery<Memory[]>({
    queryKey: ['memories'],
    queryFn: () => fetchJson<Memory[]>('/api/memories'),
    enabled: !!user,
  });

  const searchQuery = useQuery<{ results: SearchResult[] }>({
    queryKey: ['memories-search', query],
    queryFn: () =>
      fetchJson<{ results: SearchResult[] }>(`/api/memories/search?q=${encodeURIComponent(query)}`),
    enabled: !!user && query.trim().length >= 2,
  });

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--gray-1)] text-[var(--gray-11)]">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--gray-1)] px-6 py-16 text-[var(--gray-11)]">
        <div className="mx-auto max-w-md text-center">
          <Brain className="mx-auto h-8 w-8 text-[var(--accent-11)]" />
          <h1 className="mt-3 text-xl font-bold text-[var(--gray-12)]">Sign in to view memories</h1>
          <p className="mt-2 text-sm text-[var(--gray-10)]">
            Memory captures are saved to your account.{' '}
            <Link to="/login" className="underline-offset-2 hover:underline">
              Sign in
            </Link>{' '}
            to retrieve what you&apos;ve captured.
          </p>
        </div>
      </div>
    );
  }

  const memories = listQuery.data ?? [];
  const searching = query.trim().length >= 2;
  const searchResults = searchQuery.data?.results ?? [];
  const isLoading = listQuery.isFetching || (searching && searchQuery.isFetching);

  return (
    <div className="min-h-screen bg-[var(--gray-1)] text-[var(--gray-12)]">
      <div className="border-b border-[var(--gray-4)] px-6 py-3">
        <Link to="/" className="text-sm text-[var(--gray-11)] underline-offset-2 hover:underline">
          ← Back
        </Link>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8 flex items-start gap-3">
          <Brain className="mt-1 h-8 w-8 text-[var(--accent-11)]" />
          <div>
            <h1 className="text-2xl font-bold text-[var(--gray-12)]">Memory</h1>
            <p className="mt-1 text-sm text-[var(--gray-10)]">
              Captures saved to your account — read and remember, not read and forget.
            </p>
            <p className="mt-2 text-xs text-[var(--gray-9)]">{memories.length} captures saved</p>
          </div>
        </div>

        <div className="relative mb-6">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--gray-9)]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your captured memories…"
            className="border-[var(--gray-6)] bg-[var(--gray-2)] pl-10 text-[var(--gray-12)]"
          />
          {isLoading && (
            <Loader2 className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--gray-9)]" />
          )}
        </div>

        {listQuery.isError ? (
          <p className="text-sm text-[var(--gray-10)]">
            Failed to load memories. Please try again.
          </p>
        ) : !searching && memories.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--gray-5)] p-8 text-center">
            <p className="text-sm text-[var(--gray-11)]">No memories yet.</p>
            <p className="mt-1 text-xs text-[var(--gray-9)]">
              Capture pages with the Chrome extension or the browser-memory import to start building
              your library.
            </p>
          </div>
        ) : searching && searchResults.length === 0 && !searchQuery.isFetching ? (
          <p className="text-sm text-[var(--gray-10)]">No results for &quot;{query}&quot;.</p>
        ) : searching ? (
          <ul className="space-y-4">
            {searchResults.map((hit) => (
              <li
                key={hit.id}
                className="rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-4"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-medium text-[var(--gray-12)]">{hit.title}</span>
                  <Badge variant="secondary" className="text-xs">
                    memory
                  </Badge>
                </div>
                <a
                  href={hit.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[var(--gray-9)] hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {hit.url}
                </a>
                {hit.snippets
                  .filter((s) => s.field !== 'title')
                  .slice(0, 2)
                  .map((snippet, idx) => (
                    <p key={idx} className="mt-2 line-clamp-2 text-sm text-[var(--gray-11)]">
                      {snippet.text}
                    </p>
                  ))}
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--gray-9)]">
                  {hit.createdAt && <span>{formatDate(hit.createdAt)}</span>}
                  <span>· matched {hit.matchedFields.join(', ')}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-3">
            {memories.map((memory) => (
              <li
                key={memory.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)] p-4"
              >
                <div className="min-w-0 flex-1">
                  <a
                    href={memory.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-[var(--gray-12)] hover:underline"
                  >
                    {memory.title}
                  </a>
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--gray-11)]">
                    {memory.excerpt}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--gray-9)]">
                    {memory.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {memory.capturedAt && <span>captured {formatDate(memory.capturedAt)}</span>}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-[var(--gray-9)] hover:text-red-500"
                  aria-label="Delete memory"
                  onClick={async () => {
                    try {
                      await deleteMemory(memory.id);
                      await listQuery.refetch();
                    } catch {
                      /* swallow — surface via refetch state */
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
