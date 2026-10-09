import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Check, Loader2, Plus, Search, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';

import type { SavedLink } from '@/lib/links-db';
import { trackActivatedOnce, trackCoreAction } from '@/lib/analytics';
import { useAuth } from './AuthProvider';
import { Navbar } from './Navbar';
import { Button } from './ui/button';
import { Input } from './ui/input';

type Inbox = { items: SavedLink[]; total: number; nextOffset: number | null };

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, cache: 'no-store' });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Could not complete this action.');
  return body as T;
}

export default function HomeClient() {
  const { user, loading } = useAuth();
  const client = useQueryClient();
  const [filter, setFilter] = useState('unread');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [notice, setNotice] = useState('');
  const inbox = useQuery({
    queryKey: ['links', user?.id, filter, query, offset],
    enabled: Boolean(user),
    queryFn: () => {
      const params = new URLSearchParams({ q: query, offset: String(offset) });
      if (filter !== 'all') params.set('status', filter);
      return request<Inbox>(`/api/links?${params}`);
    },
  });
  const save = useMutation({
    mutationFn: () =>
      request<{ existing: boolean }>('/api/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, title }),
      }),
    onSuccess: async (result) => {
      setAdding(false);
      setUrl('');
      setTitle('');
      setOffset(0);
      setFilter('all');
      setQuery('');
      if (!result.existing) {
        trackCoreAction('source_saved');
        trackActivatedOnce();
      }
      setNotice(result.existing ? 'This link is already saved.' : 'Link saved.');
      await client.invalidateQueries({ queryKey: ['links'] });
    },
  });
  const mark = useMutation({
    mutationFn: (item: SavedLink) =>
      request(`/api/links/${encodeURIComponent(item.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: item.status === 'read' ? 'unread' : 'read' }),
      }),
    onSuccess: async () => {
      setOffset(0);
      await client.invalidateQueries({ queryKey: ['links'] });
    },
  });

  if (loading)
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--gray-1)] text-[var(--gray-11)]">
        <p role="status">Loading Reader…</p>
      </main>
    );
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-[var(--gray-1)] text-[var(--gray-12)]">
      <Navbar />
      <main className="mx-auto max-w-3xl px-5 py-10 sm:px-6">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Your links</h1>
            <p className="mt-2 text-sm text-[var(--gray-10)]">
              Save here. Pick them up in ChatGPT.
            </p>
          </div>
          <Button
            onClick={() => {
              setAdding(!adding);
              save.reset();
              setNotice('');
            }}
          >
            <Plus className="h-4 w-4" /> Add link
          </Button>
        </div>

        {adding && (
          <form
            className="mb-8 space-y-4 rounded-xl border border-[var(--gray-5)] bg-[var(--gray-2)] p-5"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <div className="space-y-2">
              <label htmlFor="link-url" className="text-sm">
                URL
              </label>
              <Input
                id="link-url"
                type="url"
                required
                placeholder="https://…"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                disabled={save.isPending}
                maxLength={4096}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="link-title" className="text-sm">
                Title <span className="text-[var(--gray-9)]">(optional)</span>
              </label>
              <Input
                id="link-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={save.isPending}
                maxLength={500}
              />
            </div>
            {save.error && (
              <p role="alert" className="text-sm text-red-400">
                {save.error.message}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={save.isPending}
                onClick={() => setAdding(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? 'Saving…' : 'Save link'}
              </Button>
            </div>
          </form>
        )}
        {notice && (
          <p role="status" className="mb-4 text-sm text-[var(--accent-11)]">
            {notice}
          </p>
        )}
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-1" aria-label="Read status">
            {['unread', 'read', 'all'].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => {
                  setFilter(value);
                  setOffset(0);
                }}
                className={`min-h-10 rounded-lg px-3 text-sm capitalize ${filter === value ? 'bg-[var(--gray-4)] text-[var(--gray-12)]' : 'text-[var(--gray-10)] hover:bg-[var(--gray-3)]'}`}
              >
                {value}
              </button>
            ))}
          </div>
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-[var(--gray-9)]" />
            <Input
              aria-label="Search links"
              placeholder="Search links"
              className="pl-9"
              value={query}
              maxLength={500}
              onChange={(event) => {
                setQuery(event.target.value);
                setOffset(0);
              }}
            />
          </div>
        </div>
        {mark.error && (
          <p role="alert" className="mb-4 text-sm text-red-400">
            {mark.error.message}
          </p>
        )}
        {inbox.isPending ? (
          <p role="status" className="py-12 text-center text-[var(--gray-9)]">
            Loading links…
          </p>
        ) : inbox.error ? (
          <div role="alert" className="py-8">
            <p>{inbox.error.message}</p>
            <Button className="mt-3" variant="outline" onClick={() => void inbox.refetch()}>
              Try again
            </Button>
          </div>
        ) : inbox.data?.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--gray-6)] px-5 py-14 text-center">
            <h2 className="text-lg font-medium">
              {query
                ? 'No matching links'
                : filter === 'unread'
                  ? 'Nothing unread'
                  : 'No links here yet'}
            </h2>
            <p className="mt-2 text-sm text-[var(--gray-10)]">
              {query
                ? 'Try another title or URL.'
                : 'Add a link above or save a page with the extension.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--gray-5)] border-y border-[var(--gray-5)]">
            {inbox.data?.items.map((item) => (
              <li key={item.id} className="flex items-center gap-4 py-5">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group min-w-0 flex-1"
                >
                  <span className="flex items-start gap-2 text-base font-medium leading-6 break-words group-hover:text-[var(--accent-11)]">
                    <span className="min-w-0">{item.title}</span>
                    <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-[var(--gray-9)]" />
                  </span>
                  <span className="mt-1 block truncate text-xs text-[var(--gray-9)]">
                    {new URL(item.url).hostname} · {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </a>
                <button
                  type="button"
                  disabled={mark.isPending}
                  onClick={() => mark.mutate(item)}
                  aria-label={`${item.status === 'read' ? 'Mark unread' : 'Mark read'}: ${item.title}`}
                  title={item.status === 'read' ? 'Mark unread' : 'Mark read'}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[var(--gray-5)] text-[var(--gray-10)] hover:bg-[var(--gray-3)] disabled:opacity-50"
                >
                  {mark.isPending && mark.variables?.id === item.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : item.status === 'read' ? (
                    <Undo2 className="h-4 w-4" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
        {inbox.data && inbox.data.total > 0 && (
          <div className="mt-5 flex items-center justify-between gap-3 text-sm text-[var(--gray-9)]">
            <span>
              {inbox.data.total} {inbox.data.total === 1 ? 'link' : 'links'}
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - 20))}
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                disabled={inbox.data.nextOffset === null}
                onClick={() => setOffset(inbox.data?.nextOffset ?? 0)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
