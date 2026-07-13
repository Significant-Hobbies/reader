import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  Circle,
  ExternalLink,
  FileUp,
  Library,
  Loader2,
  Plus,
  RefreshCw,
  Rss,
  Trash2,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '@/components/AuthProvider';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { cn, formatDate } from '@/lib/utils';
import type { RssEntry, RssFeed } from '@/types';

type InboxMode = 'unread' | 'all';

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export default function RssPage() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFeedId, setSelectedFeedId] = useState<string>('all');
  const [mode, setMode] = useState<InboxMode>('unread');
  const [addOpen, setAddOpen] = useState(false);
  const [feedUrl, setFeedUrl] = useState('');
  const [feedTitle, setFeedTitle] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const feedsQuery = useQuery<RssFeed[]>({
    queryKey: ['rss-feeds'],
    queryFn: () => jsonRequest('/api/rss/feeds', { cache: 'no-store' }),
    enabled: Boolean(user),
  });
  const entriesQuery = useQuery<RssEntry[]>({
    queryKey: ['rss-entries', selectedFeedId, mode],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedFeedId !== 'all') params.set('feedId', selectedFeedId);
      if (mode === 'unread') params.set('unread', 'true');
      return jsonRequest(`/api/rss/entries?${params.toString()}`, { cache: 'no-store' });
    },
    enabled: Boolean(user),
  });

  const invalidateRss = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['rss-feeds'] }),
      queryClient.invalidateQueries({ queryKey: ['rss-entries'] }),
    ]);
  };

  const addMutation = useMutation({
    mutationFn: () =>
      jsonRequest<{ id: string; existing: boolean }>('/api/rss/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedUrl, title: feedTitle || undefined }),
      }),
    onSuccess: async (result) => {
      setNotice(
        result.existing ? 'You already follow this feed.' : 'Feed added. Refresh to fetch posts.'
      );
      setFeedUrl('');
      setFeedTitle('');
      setAddOpen(false);
      await invalidateRss();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => jsonRequest(`/api/rss/feeds/${id}`, { method: 'DELETE' }),
    onSuccess: async (_data, id) => {
      if (selectedFeedId === id) setSelectedFeedId('all');
      setNotice('Feed removed.');
      await invalidateRss();
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () =>
      jsonRequest<{ results: Array<{ status: string; inserted: number }> }>('/api/rss/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedFeedId === 'all' ? {} : { feedId: selectedFeedId }),
      }),
    onSuccess: async ({ results }) => {
      const inserted = results.reduce((sum, result) => sum + result.inserted, 0);
      const failures = results.filter((result) => result.status === 'error').length;
      setNotice(
        `${inserted} new ${inserted === 1 ? 'post' : 'posts'}${failures ? ` · ${failures} feeds failed` : ''}`
      );
      await invalidateRss();
    },
  });

  const importMutation = useMutation({
    mutationFn: (opml: string) =>
      jsonRequest<{ imported: number; existing: number; rejected: number }>('/api/rss/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opml }),
      }),
    onSuccess: async (result) => {
      setNotice(
        `Imported ${result.imported} feeds · ${result.existing} already followed${
          result.rejected ? ` · ${result.rejected} rejected` : ''
        }`
      );
      await invalidateRss();
    },
  });

  const readMutation = useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) =>
      jsonRequest(`/api/rss/entries/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ read }),
      }),
    onSuccess: invalidateRss,
  });

  const saveMutation = useMutation({
    mutationFn: (id: string) =>
      jsonRequest<{ id: string; existing: boolean }>(`/api/rss/entries/${id}/save`, {
        method: 'POST',
      }),
    onSuccess: async () => {
      setNotice('Saved to your library.');
      await Promise.all([
        invalidateRss(),
        queryClient.invalidateQueries({ queryKey: ['articles'] }),
      ]);
    },
  });

  const error =
    feedsQuery.error ||
    entriesQuery.error ||
    addMutation.error ||
    removeMutation.error ||
    refreshMutation.error ||
    importMutation.error ||
    readMutation.error ||
    saveMutation.error;

  const feeds = feedsQuery.data ?? [];
  const entries = entriesQuery.data ?? [];
  const totalUnread = feeds.reduce((sum, feed) => sum + feed.unreadCount, 0);

  if (authLoading) {
    return <div className="min-h-screen bg-zinc-950" />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <Navbar />
        <main className="mx-auto max-w-xl px-6 py-24 text-center">
          <Rss className="mx-auto h-10 w-10 text-[var(--accent-11)]" />
          <h1 className="mt-5 text-2xl font-semibold">Sign in to use RSS</h1>
          <p className="mt-2 text-sm text-zinc-400">
            Subscriptions and read state sync to your Reader account.
          </p>
          <Button asChild className="mt-6">
            <Link to="/login">Sign in</Link>
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <header className="flex flex-col gap-4 border-b border-zinc-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-orange-300">
              <Rss className="h-4 w-4" /> Feed reader
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Your reading inbox</h1>
            <p className="mt-2 text-sm text-zinc-400">
              {feeds.length} feeds · {totalUnread} unread
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".opml,.xml,text/xml,application/xml"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (file) importMutation.mutate(await file.text());
                event.target.value = '';
              }}
            />
            <Button
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={importMutation.isPending}
            >
              <FileUp className="mr-2 h-4 w-4" /> Import OPML
            </Button>
            <Button variant="secondary" onClick={() => setAddOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add feed
            </Button>
            <Button
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending || feeds.length === 0}
            >
              <RefreshCw
                className={cn('mr-2 h-4 w-4', refreshMutation.isPending && 'animate-spin')}
              />
              Refresh
            </Button>
          </div>
        </header>

        {(notice || error) && (
          <div
            className={cn(
              'mt-4 rounded-lg border px-4 py-3 text-sm',
              error
                ? 'border-red-900 bg-red-950/50 text-red-200'
                : 'border-zinc-800 bg-zinc-900 text-zinc-300'
            )}
          >
            {error instanceof Error ? error.message : notice}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-2">
              <button
                type="button"
                onClick={() => setSelectedFeedId('all')}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm',
                  selectedFeedId === 'all'
                    ? 'bg-zinc-800 text-zinc-100'
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                )}
              >
                <span>All feeds</span>
                <span>{totalUnread}</span>
              </button>
              <div className="my-2 border-t border-zinc-800" />
              <div className="max-h-[55vh] space-y-0.5 overflow-y-auto">
                {feeds.map((feed) => (
                  <div key={feed.id} className="group flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedFeedId(feed.id)}
                      className={cn(
                        'min-w-0 flex-1 rounded-lg px-3 py-2 text-left text-sm',
                        selectedFeedId === feed.id
                          ? 'bg-zinc-800 text-zinc-100'
                          : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate">{feed.title}</span>
                        {feed.unreadCount > 0 && (
                          <span className="text-xs text-zinc-500">{feed.unreadCount}</span>
                        )}
                      </span>
                      {feed.lastError && (
                        <span
                          className="mt-1 block truncate text-xs text-red-400"
                          title={feed.lastError}
                        >
                          Refresh failed
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${feed.title}`}
                      title={`Remove ${feed.title}`}
                      className="rounded-md p-2 text-zinc-600 opacity-100 hover:bg-red-950 hover:text-red-300 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
                      onClick={() => {
                        if (window.confirm(`Remove ${feed.title} and its feed entries?`))
                          removeMutation.mutate(feed.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <section>
            <div className="mb-4 flex items-center justify-between gap-3">
              <SegmentedControl<InboxMode>
                value={mode}
                onValueChange={setMode}
                options={[
                  { value: 'unread', label: 'Unread' },
                  { value: 'all', label: 'All posts' },
                ]}
              />
              {entriesQuery.isFetching && (
                <Loader2
                  className="h-4 w-4 animate-spin text-zinc-500"
                  aria-label="Loading posts"
                />
              )}
            </div>

            {feedsQuery.isLoading ? (
              <div className="rounded-xl border border-zinc-800 p-12 text-center text-zinc-500">
                Loading feeds…
              </div>
            ) : feeds.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-700 px-6 py-16 text-center">
                <Rss className="mx-auto h-9 w-9 text-zinc-600" />
                <h2 className="mt-4 text-lg font-medium">Add your first feeds</h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
                  Import an OPML file or add a feed URL directly. Then refresh to fill your inbox.
                </p>
                <div className="mt-5 flex justify-center gap-2">
                  <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
                    Import OPML
                  </Button>
                  <Button onClick={() => setAddOpen(true)}>Add feed</Button>
                </div>
              </div>
            ) : entries.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-700 px-6 py-16 text-center">
                <Check className="mx-auto h-9 w-9 text-emerald-500" />
                <h2 className="mt-4 text-lg font-medium">
                  {mode === 'unread' ? 'You’re all caught up' : 'No posts yet'}
                </h2>
                <p className="mt-2 text-sm text-zinc-400">
                  {mode === 'unread'
                    ? 'Switch to all posts or refresh your feeds.'
                    : 'Refresh feeds to fetch their latest posts.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/30">
                {entries.map((entry) => (
                  <article
                    key={entry.id}
                    className={cn('p-4 sm:p-5', !entry.readAt && 'bg-zinc-900/60')}
                  >
                    <div className="flex gap-3">
                      <button
                        type="button"
                        className="mt-1 shrink-0 rounded-full text-zinc-500 hover:text-zinc-100"
                        aria-label={entry.readAt ? 'Mark unread' : 'Mark read'}
                        onClick={() => readMutation.mutate({ id: entry.id, read: !entry.readAt })}
                      >
                        {entry.readAt ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Circle className="h-4 w-4 fill-orange-400 text-orange-400" />
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
                          <span className="font-medium text-zinc-400">{entry.feedTitle}</span>
                          {entry.author && <span>by {entry.author}</span>}
                          {entry.publishedAt && (
                            <time dateTime={entry.publishedAt}>
                              {formatDate(entry.publishedAt)}
                            </time>
                          )}
                        </div>
                        <h2
                          className={cn(
                            'mt-1.5 text-base leading-snug',
                            entry.readAt
                              ? 'font-medium text-zinc-400'
                              : 'font-semibold text-zinc-100'
                          )}
                        >
                          {entry.title}
                        </h2>
                        {entry.excerpt && (
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-400">
                            {entry.excerpt}
                          </p>
                        )}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {entry.url && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                window.open(entry.url, '_blank', 'noopener,noreferrer');
                                if (!entry.readAt)
                                  readMutation.mutate({ id: entry.id, read: true });
                              }}
                            >
                              <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open original
                            </Button>
                          )}
                          {entry.savedArticleId ? (
                            <Button asChild size="sm" variant="ghost">
                              <Link to={`/reader/${entry.savedArticleId}`}>
                                <Library className="mr-1.5 h-3.5 w-3.5" /> In library
                              </Link>
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={!entry.url || saveMutation.isPending}
                              onClick={() => saveMutation.mutate(entry.id)}
                            >
                              <Library className="mr-1.5 h-3.5 w-3.5" /> Save to library
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add an RSS feed</DialogTitle>
            <DialogDescription>
              Paste a direct RSS or Atom feed URL. You can name it now or let the first refresh
              discover its title.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              addMutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="rss-feed-url">Feed URL</Label>
              <Input
                id="rss-feed-url"
                type="url"
                required
                autoFocus
                placeholder="https://example.com/feed.xml"
                value={feedUrl}
                onChange={(event) => setFeedUrl(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rss-feed-title">
                Name <span className="text-zinc-500">(optional)</span>
              </Label>
              <Input
                id="rss-feed-title"
                placeholder="Example Blog"
                value={feedTitle}
                onChange={(event) => setFeedTitle(event.target.value)}
              />
            </div>
            {addMutation.error && (
              <p className="text-sm text-red-300">{addMutation.error.message}</p>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addMutation.isPending || !feedUrl.trim()}>
                {addMutation.isPending ? 'Adding…' : 'Add feed'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
