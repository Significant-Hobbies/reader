'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, FileText, Heart, LayoutDashboard, MoreVertical, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type MouseEvent, useState } from 'react';

import { getCategoryColor } from '../lib/category-utils';
import { formatReadingTime } from '../lib/reading-time-utils';
import { getTagColor } from '../lib/tag-utils';
import { formatDate } from '../lib/utils';
import type { ArticleStatus, ArticleSummary, List } from '../types';
import { AddArticleDialog } from './AddArticleDialog';
import { Navbar } from './Navbar';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Input } from './ui/input';
import { Label } from './ui/label';

export default function HomeClient() {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeToolbarId, setActiveToolbarId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [newListName, setNewListName] = useState('');
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [showAddArticleDialog, setShowAddArticleDialog] = useState(false);

  const router = useRouter();
  const queryClient = useQueryClient();

  const handleArticleCardClick = (event: MouseEvent<HTMLElement>, articleId: string) => {
    if (event.defaultPrevented) return;

    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.closest('button, a, input, textarea, select, [role="menuitem"]')
    ) {
      return;
    }

    router.push(`/reader/${articleId}`);
  };

  const {
    data: articles = [],
    isLoading,
    error: articlesError,
  } = useQuery<ArticleSummary[]>({
    queryKey: ['articles'],
    queryFn: async () => {
      const response = await fetch('/api/articles', { cache: 'no-store' });
      if (!response.ok) {
        const err = new Error('Failed to fetch articles');
        (err as Error & { status: number }).status = response.status;
        throw err;
      }
      return response.json();
    },
  });

  const { data: lists = [], error: listsError } = useQuery<List[]>({
    queryKey: ['lists'],
    queryFn: async () => {
      const response = await fetch('/api/lists', { cache: 'no-store' });
      if (!response.ok) {
        const err = new Error('Failed to fetch lists');
        (err as Error & { status: number }).status = response.status;
        throw err;
      }
      return response.json();
    },
  });

  const { data: allTags = [] } = useQuery<string[]>({
    queryKey: ['tags'],
    queryFn: async () => {
      const response = await fetch('/api/tags', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to fetch tags');
      }
      const data = await response.json();
      return data.tags;
    },
  });

  const importMutation = useMutation({
    mutationFn: async ({ url: rawUrl, category }: { url: string; category?: string }) => {
      let properUrl = rawUrl;
      if (!/^https?:\/\//i.test(rawUrl)) {
        properUrl = `https://${rawUrl}`;
      }

      const response = await fetch(`/api/snapshot?url=${encodeURIComponent(properUrl)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch article content');
      }

      const data = await response.json();
      const article = data.snapshot;
      const snapshotTitle = (article.title || '').trim() || properUrl;

      const saveResponse = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: properUrl,
          title: snapshotTitle,
          byline: article.byline,
          content: article.content,
          listIds: selectedListId !== 'all' ? [selectedListId] : [],
          category,
        }),
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to save article');
      }

      const savedData = await saveResponse.json();
      return savedData.id as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      setShowAddArticleDialog(false);
    },
  });

  const pdfUploadMutation = useMutation({
    mutationFn: async ({ file, category }: { file: File; category?: string }) => {
      // Extract text client-side using pdfjs-dist
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      const pages: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item) => ('str' in item ? item.str : '')).join(' ');
        pages.push(pageText);
      }

      const extractedText = pages.join('\n\n');
      const metadata = await pdf.getMetadata().catch(() => null);
      const info = metadata?.info as Record<string, unknown> | undefined;
      const title =
        (typeof info?.Title === 'string' ? info.Title : '') || file.name.replace('.pdf', '');

      // Save as article via existing API (no server upload needed)
      const response = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: `pdf://${file.name}`,
          title,
          content: extractedText,
          type: 'pdf',
          extractedText,
          pdfMetadata: { pageCount: pdf.numPages, fileSize: file.size },
          listIds: selectedListId !== 'all' ? [selectedListId] : [],
          category,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save PDF article');
      }

      const data = await response.json();
      return data.id as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      setShowAddArticleDialog(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (articleId: string) => {
      const response = await fetch(`/api/articles/${articleId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete article');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
    onSettled: () => {
      setDeletingId(null);
    },
  });

  const handleUrlSubmit = async (url: string, category?: string) => {
    try {
      const newArticleId = await importMutation.mutateAsync({ url, category });
      router.push(`/reader/${newArticleId}`);
    } catch (error) {
      console.error('Import failed:', error);
      throw error; // Re-throw so AddArticleDialog can display it
    }
  };

  const handlePDFUpload = async (file: File, category?: string) => {
    try {
      const newArticleId = await pdfUploadMutation.mutateAsync({ file, category });
      router.push(`/reader/${newArticleId}`);
    } catch (error) {
      console.error('PDF processing failed:', error);
      throw error; // Re-throw so AddArticleDialog can display it
    }
  };

  const isImporting = importMutation.isPending || pdfUploadMutation.isPending;

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ArticleStatus }) => {
      const response = await fetch(`/api/articles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        throw new Error('Failed to update status');
      }
      return { id, status };
    },
    onSuccess: ({ id, status }) => {
      queryClient.setQueryData<ArticleSummary[]>(['articles'], (prev) =>
        Array.isArray(prev)
          ? prev.map((article) => (article.id === id ? { ...article, status } : article))
          : prev
      );
    },
  });

  const createListMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        throw new Error('Failed to create list');
      }
    },
    onSuccess: () => {
      setNewListName('');
      setIsListModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['lists'] });
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: async (listId: string) => {
      const response = await fetch(`/api/lists/${listId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete list');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      setSelectedListId('all');
    },
  });

  const addToListMutation = useMutation({
    mutationFn: async ({ articleId, listId }: { articleId: string; listId: string }) => {
      const response = await fetch(`/api/articles/${articleId}/lists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listId }),
      });
      if (!response.ok) {
        throw new Error('Failed to add to list');
      }
      return { articleId, listId };
    },
    onSuccess: ({ articleId, listId }) => {
      queryClient.setQueryData<ArticleSummary[]>(['articles'], (prev) =>
        Array.isArray(prev)
          ? prev.map((article) =>
              article.id === articleId
                ? {
                    ...article,
                    listIds: [...(article.listIds || []), listId],
                  }
                : article
            )
          : prev
      );
    },
  });

  const removeFromListMutation = useMutation({
    mutationFn: async ({ articleId, listId }: { articleId: string; listId: string }) => {
      const response = await fetch(`/api/articles/${articleId}/lists?listId=${listId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to remove from list');
      }
      return { articleId, listId };
    },
    onSuccess: ({ articleId, listId }) => {
      queryClient.setQueryData<ArticleSummary[]>(['articles'], (prev) =>
        Array.isArray(prev)
          ? prev.map((article) =>
              article.id === articleId
                ? {
                    ...article,
                    listIds: (article.listIds || []).filter((id) => id !== listId),
                  }
                : article
            )
          : prev
      );
    },
  });

  const handleDelete = async (articleId: string) => {
    setDeletingId(articleId);
    setPendingDeleteId(null);
    setActiveToolbarId(null);
    try {
      await deleteMutation.mutateAsync(articleId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete article';
      console.error(error);
      alert(message);
    }
  };

  const articlePendingDelete = pendingDeleteId
    ? articles.find((article) => article.id === pendingDeleteId)
    : null;

  const closeDeleteModal = () => {
    if (deletingId) return;
    setPendingDeleteId(null);
  };

  const filteredArticles = articles
    .filter((article) =>
      selectedListId === 'all' ? true : article.listIds?.includes(selectedListId)
    )
    .filter((article) => (selectedTag ? article.tags?.includes(selectedTag) : true));

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-gray-900 font-sans text-gray-100">
      <Navbar />
      <div className="flex">
        {/* Sidebar for Lists */}
        <aside className="min-h-screen w-64 space-y-4 border-r border-gray-800 p-6">
          <div className="mb-6">
            <h3 className="mb-3 text-sm font-medium tracking-wide text-gray-400 uppercase">
              Navigate
            </h3>
            <Link
              href="/"
              className="flex w-full items-center gap-3 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white"
            >
              <FileText size={18} />
              Articles
            </Link>
            <Link
              href="/board"
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-gray-800"
            >
              <LayoutDashboard size={18} />
              Boards
            </Link>
          </div>
          <div className="mb-4 border-t border-gray-700" />
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-sm font-medium tracking-wide text-gray-400 uppercase">Lists</h3>
            <Dialog open={isListModalOpen} onOpenChange={setIsListModalOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 border-gray-700 px-2 text-xs text-gray-300 hover:bg-gray-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create list</DialogTitle>
                  <p className="text-sm text-gray-400">Organize your articles into a list.</p>
                </DialogHeader>
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newListName.trim() || createListMutation.isPending) return;
                    createListMutation.mutate(newListName.trim());
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="list-name">List name</Label>
                    <Input
                      id="list-name"
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      placeholder="e.g. Research, Inspiration"
                      autoFocus
                    />
                  </div>
                  <DialogFooter className="flex justify-end gap-2">
                    <Button variant="ghost" type="button" onClick={() => setIsListModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createListMutation.isPending}>
                      {createListMutation.isPending ? 'Creating…' : 'Create'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* All Articles */}
          <button
            onClick={() => setSelectedListId('all')}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              selectedListId === 'all'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <FileText size={18} />
            All Articles
          </button>

          {/* Default Lists */}
          {lists
            .filter((list) => list.isDefault)
            .map((list) => (
              <button
                key={list.id}
                onClick={() => setSelectedListId(list.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  selectedListId === list.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800'
                }`}
              >
                {list.icon === 'heart' && <Heart size={18} />}
                {list.icon === 'clock' && <Clock size={18} />}
                {list.name}
              </button>
            ))}

          {/* Custom Lists */}
          {lists.filter((list) => !list.isDefault).length > 0 && (
            <>
              <div className="my-4 border-t border-gray-700" />
              {lists
                .filter((list) => !list.isDefault)
                .map((list) => (
                  <div key={list.id} className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedListId(list.id)}
                      className={`flex flex-1 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        selectedListId === list.id
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      <div className={`h-2 w-2 rounded-full bg-${list.color || 'blue'}-500`} />
                      {list.name}
                    </button>
                    {selectedListId === list.id && !list.isDefault && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                        onClick={() => deleteListMutation.mutate(list.id)}
                        disabled={deleteListMutation.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
            </>
          )}

          {listsError && <span className="text-xs text-red-400">Failed to load lists</span>}
        </aside>

        {/* Main Content */}
        <div className="flex-1 p-8">
          <div className="mx-auto max-w-6xl space-y-6">
            <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h1 className="text-3xl font-bold text-white">
                  {selectedListId === 'all'
                    ? 'All Articles'
                    : lists.find((l) => l.id === selectedListId)?.name || 'My Library'}
                </h1>
                <p className="mt-1 text-gray-400">Manage your annotated articles and PDFs</p>
              </div>

              <Button onClick={() => setShowAddArticleDialog(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Content
              </Button>
            </div>

            {allTags.length > 0 && (
              <div className="rounded-xl border border-gray-800 bg-gray-900/70 p-4 shadow-lg backdrop-blur">
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-xs tracking-wide text-gray-500 uppercase">
                    Filter by tag
                  </span>
                  {selectedTag && (
                    <button
                      onClick={() => setSelectedTag(null)}
                      className="text-xs text-blue-400 transition-colors hover:text-blue-300"
                    >
                      Clear filter
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                        selectedTag === tag
                          ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-950'
                          : ''
                      } ${getTagColor(tag)} hover:opacity-80`}
                    >
                      {tag}
                      {selectedTag === tag && <X className="ml-1 h-3 w-3" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {articlesError && (
              <div className="mb-6 rounded-lg border border-red-800 bg-red-950/80 px-4 py-3 text-red-200">
                Failed to load articles. Please try again.
              </div>
            )}

            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {articles.length === 0 ? (
                  <div className="col-span-full rounded-2xl border border-dashed border-gray-700 bg-gray-800 py-16 text-center">
                    <p className="mb-4 text-lg text-gray-300">Your library is empty.</p>
                    <p className="text-gray-500">Import a URL or upload a PDF to get started.</p>
                  </div>
                ) : filteredArticles.length === 0 ? (
                  <div className="col-span-full rounded-2xl border border-dashed border-gray-700 bg-gray-800 py-16 text-center">
                    <p className="mb-4 text-lg text-gray-300">No articles match your filters.</p>
                    <button
                      onClick={() => {
                        setSelectedListId('all');
                        setSelectedTag(null);
                      }}
                      className="text-blue-400 transition-colors hover:text-blue-300"
                    >
                      Clear all filters
                    </button>
                  </div>
                ) : (
                  filteredArticles.map((article) => {
                    const nextStatus: ArticleStatus =
                      article.status === 'read' ? 'in_progress' : 'read';
                    const displayTitle = article.title || article.url;
                    const isPDF = article.type === 'pdf';
                    return (
                      <div
                        key={article.id}
                        onClick={(event) => handleArticleCardClick(event, article.id)}
                        className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-950 shadow-xl transition-all hover:border-blue-600 hover:shadow-2xl"
                      >
                        <div className="flex flex-1 flex-col gap-3 p-6">
                          {/* Category Badge at Top */}
                          {article.category && (
                            <div className="mb-1 flex items-center gap-2">
                              <Badge
                                variant={
                                  getCategoryColor(article.category) as
                                    | 'default'
                                    | 'secondary'
                                    | 'blue'
                                    | 'success'
                                    | 'warning'
                                    | 'cyan'
                                    | 'green'
                                    | 'yellow'
                                    | 'orange'
                                    | 'red'
                                    | 'pink'
                                    | 'purple'
                                    | 'indigo'
                                }
                              >
                                {article.category}
                              </Badge>
                              {isPDF && (
                                <FileText className="ml-auto h-4 w-4 flex-shrink-0 text-blue-400" />
                              )}
                            </div>
                          )}

                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1 pr-2">
                              <div className="mb-2 flex items-center gap-2">
                                <h2
                                  className="line-clamp-2 flex-1 text-xl font-semibold break-words text-white transition-colors group-hover:text-blue-300"
                                  title={displayTitle}
                                >
                                  {displayTitle}
                                </h2>
                                {!article.category && isPDF && (
                                  <FileText className="h-5 w-5 flex-shrink-0 text-blue-400" />
                                )}
                              </div>
                              <p className="truncate text-sm text-gray-400" title={article.url}>
                                {isPDF ? 'PDF Document' : article.url}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-300">
                                {article.status === 'read' && (
                                  <Badge
                                    variant="success"
                                    className="cursor-pointer"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleStatus.mutate({ id: article.id, status: nextStatus });
                                    }}
                                  >
                                    Read
                                  </Badge>
                                )}
                                {article.readingTimeMinutes && (
                                  <Badge variant="blue" className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {formatReadingTime(article.readingTimeMinutes)}
                                  </Badge>
                                )}
                                {article.type === 'pdf' && article.pdfMetadata?.pageCount && (
                                  <Badge variant="secondary">
                                    {article.pdfMetadata.pageCount} pages
                                  </Badge>
                                )}
                              </div>
                              {article.tags && article.tags.length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                  {article.tags.map((tag) => (
                                    <button
                                      key={tag}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedTag(tag);
                                      }}
                                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold transition-colors ${getTagColor(tag)} hover:opacity-80`}
                                    >
                                      {tag}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <DropdownMenu
                              open={activeToolbarId === article.id}
                              onOpenChange={(open) => {
                                setActiveToolbarId(open ? article.id : null);
                              }}
                            >
                              <DropdownMenuTrigger asChild>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                  }}
                                  aria-label="Article actions"
                                  className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-800 hover:text-white"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  onSelect={() => {
                                    toggleStatus.mutate({ id: article.id, status: nextStatus });
                                  }}
                                >
                                  {article.status === 'read' ? 'Mark In Progress' : 'Mark Read'}
                                </DropdownMenuItem>
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger>Add to list</DropdownMenuSubTrigger>
                                  <DropdownMenuSubContent>
                                    {lists
                                      .filter((list) => !article.listIds?.includes(list.id))
                                      .map((list) => (
                                        <DropdownMenuItem
                                          key={list.id}
                                          onSelect={() =>
                                            addToListMutation.mutate({
                                              articleId: article.id,
                                              listId: list.id,
                                            })
                                          }
                                        >
                                          {list.icon === 'heart' && (
                                            <Heart className="mr-2 h-4 w-4" />
                                          )}
                                          {list.icon === 'clock' && (
                                            <Clock className="mr-2 h-4 w-4" />
                                          )}
                                          {list.icon === 'dot' && (
                                            <div
                                              className={`h-2 w-2 rounded-full bg-${list.color || 'blue'}-500 mr-2`}
                                            />
                                          )}
                                          {list.name}
                                        </DropdownMenuItem>
                                      ))}
                                    {lists.filter((list) => !article.listIds?.includes(list.id))
                                      .length === 0 && (
                                      <DropdownMenuItem disabled>
                                        Already in all lists
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuSubContent>
                                </DropdownMenuSub>
                                {article.listIds && article.listIds.length > 0 && (
                                  <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>
                                      Remove from list
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                      {lists
                                        .filter((list) => article.listIds?.includes(list.id))
                                        .map((list) => (
                                          <DropdownMenuItem
                                            key={list.id}
                                            onSelect={() =>
                                              removeFromListMutation.mutate({
                                                articleId: article.id,
                                                listId: list.id,
                                              })
                                            }
                                            className="text-yellow-300 focus:text-yellow-100"
                                          >
                                            {list.icon === 'heart' && (
                                              <Heart className="mr-2 h-4 w-4" />
                                            )}
                                            {list.icon === 'clock' && (
                                              <Clock className="mr-2 h-4 w-4" />
                                            )}
                                            {list.icon === 'dot' && (
                                              <div
                                                className={`h-2 w-2 rounded-full bg-${list.color || 'blue'}-500 mr-2`}
                                              />
                                            )}
                                            {list.name}
                                          </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuSubContent>
                                  </DropdownMenuSub>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-300 focus:text-red-100"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                  }}
                                  onSelect={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    if (deletingId) return;
                                    setPendingDeleteId(article.id);
                                    setActiveToolbarId(null);
                                  }}
                                >
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          {article.byline && (
                            <p
                              className="line-clamp-1 text-sm text-gray-500 italic"
                              title={article.byline}
                            >
                              By {article.byline}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-700 bg-gray-900/60 px-6 py-4 text-sm text-gray-400">
                          <Badge variant="default">{article.notesCount} notes</Badge>
                          <span className="text-gray-500">{formatDate(article.createdAt)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Article Dialog */}
      <AddArticleDialog
        open={showAddArticleDialog}
        onOpenChange={setShowAddArticleDialog}
        onSubmitUrl={handleUrlSubmit}
        onUploadPDF={handlePDFUpload}
        isSubmitting={isImporting}
      />

      {articlePendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeDeleteModal}
          />
          <div
            className="relative mx-4 w-full max-w-md space-y-4 rounded-2xl border border-gray-700 bg-gray-900 p-6 shadow-2xl"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div>
              <h3 className="text-xl font-semibold text-white">
                Delete {articlePendingDelete.type === 'pdf' ? 'PDF' : 'article'}?
              </h3>
              <p className="mt-2 text-sm text-gray-400">
                {articlePendingDelete.title || articlePendingDelete.url}
              </p>
            </div>
            <p className="text-sm text-gray-500">
              This removes the {articlePendingDelete.type === 'pdf' ? 'PDF' : 'article'} and all of
              its notes permanently. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  closeDeleteModal();
                }}
                disabled={Boolean(deletingId)}
                className="rounded-lg border border-gray-600 px-4 py-2 text-gray-200 transition hover:bg-gray-800 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  void handleDelete(articlePendingDelete.id);
                }}
                disabled={deletingId === articlePendingDelete.id}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white transition hover:bg-red-500 disabled:opacity-40"
              >
                {deletingId === articlePendingDelete.id ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
