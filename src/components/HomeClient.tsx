'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { formatDate } from '../lib/utils';
import { formatReadingTime } from '../lib/reading-time-utils';
import { ArticleSummary, ArticleStatus, List } from '../types';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from './ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { MoreVertical, X, Clock, FileText, Heart, Plus } from 'lucide-react';
import { Navbar } from './Navbar';
import { getTagColor } from '../lib/tag-utils';
import { getCategoryColor } from '../lib/category-utils';
import { AddArticleDialog } from './AddArticleDialog';

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
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

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
        <aside className="w-64 min-h-screen border-r border-gray-800 p-6 space-y-4">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">Lists</h3>
            <Dialog open={isListModalOpen} onOpenChange={setIsListModalOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                  <Plus className="h-4 w-4" />
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
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
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
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
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
              <div className="border-t border-gray-700 my-4" />
              {lists
                .filter((list) => !list.isDefault)
                .map((list) => (
                  <div key={list.id} className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedListId(list.id)}
                      className={`flex-1 flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedListId === list.id
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-300 hover:bg-gray-800'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full bg-${list.color || 'blue'}-500`} />
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
          <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <div>
                <h1 className="text-3xl font-bold text-white">
                  {selectedListId === 'all'
                    ? 'All Articles'
                    : lists.find((l) => l.id === selectedListId)?.name || 'My Library'}
                </h1>
                <p className="text-gray-400 mt-1">Manage your annotated articles and PDFs</p>
              </div>

              <Button onClick={() => setShowAddArticleDialog(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Content
              </Button>
            </div>

            {allTags.length > 0 && (
              <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4 shadow-lg backdrop-blur">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs uppercase tracking-wide text-gray-500">
                    Filter by tag
                  </span>
                  {selectedTag && (
                    <button
                      onClick={() => setSelectedTag(null)}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
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
              <div className="bg-red-950/80 border border-red-800 text-red-200 px-4 py-3 rounded-lg mb-6">
                Failed to load articles. Please try again.
              </div>
            )}

            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {articles.length === 0 ? (
                  <div className="col-span-full text-center py-16 bg-gray-800 rounded-2xl border border-gray-700 border-dashed">
                    <p className="text-gray-300 text-lg mb-4">Your library is empty.</p>
                    <p className="text-gray-500">Import a URL or upload a PDF to get started.</p>
                  </div>
                ) : filteredArticles.length === 0 ? (
                  <div className="col-span-full text-center py-16 bg-gray-800 rounded-2xl border border-gray-700 border-dashed">
                    <p className="text-gray-300 text-lg mb-4">No articles match your filters.</p>
                    <button
                      onClick={() => {
                        setSelectedListId('all');
                        setSelectedTag(null);
                      }}
                      className="text-blue-400 hover:text-blue-300 transition-colors"
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
                        onClick={() => router.push(`/reader/${article.id}`)}
                        className="group relative bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl border border-gray-800 shadow-xl hover:shadow-2xl hover:border-blue-600 cursor-pointer transition-all overflow-hidden flex flex-col h-full"
                      >
                        <div className="p-6 flex-1 flex flex-col gap-3">
                          {/* Category Badge at Top */}
                          {article.category && (
                            <div className="flex items-center gap-2 mb-1">
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
                                <FileText className="h-4 w-4 text-blue-400 flex-shrink-0 ml-auto" />
                              )}
                            </div>
                          )}

                          <div className="flex items-start gap-2">
                            <div className="flex-1 pr-2 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <h2
                                  className="text-xl font-semibold text-white line-clamp-2 break-words group-hover:text-blue-300 transition-colors flex-1"
                                  title={displayTitle}
                                >
                                  {displayTitle}
                                </h2>
                                {!article.category && isPDF && (
                                  <FileText className="h-5 w-5 text-blue-400 flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-sm text-gray-400 truncate" title={article.url}>
                                {isPDF ? 'PDF Document' : article.url}
                              </p>
                              <div className="flex items-center gap-2 mt-2 text-xs text-gray-300 flex-wrap">
                                <Badge
                                  variant={article.status === 'read' ? 'success' : 'warning'}
                                  className="cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleStatus.mutate({ id: article.id, status: nextStatus });
                                  }}
                                >
                                  {article.status === 'read' ? 'Read' : 'In Progress'}
                                </Badge>
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
                                <div className="flex flex-wrap gap-1.5 mt-3">
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
                                  className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
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
                                            <Heart className="h-4 w-4 mr-2" />
                                          )}
                                          {list.icon === 'clock' && (
                                            <Clock className="h-4 w-4 mr-2" />
                                          )}
                                          {list.icon === 'dot' && (
                                            <div
                                              className={`w-2 h-2 rounded-full bg-${list.color || 'blue'}-500 mr-2`}
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
                                              <Heart className="h-4 w-4 mr-2" />
                                            )}
                                            {list.icon === 'clock' && (
                                              <Clock className="h-4 w-4 mr-2" />
                                            )}
                                            {list.icon === 'dot' && (
                                              <div
                                                className={`w-2 h-2 rounded-full bg-${list.color || 'blue'}-500 mr-2`}
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
                                  onSelect={() => {
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
                              className="text-sm text-gray-500 italic line-clamp-1"
                              title={article.byline}
                            >
                              By {article.byline}
                            </p>
                          )}
                        </div>
                        <div className="px-6 py-4 bg-gray-900/60 border-t border-gray-700 flex flex-wrap items-center gap-3 justify-between text-sm text-gray-400">
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
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 space-y-4">
            <div>
              <h3 className="text-xl font-semibold text-white">
                Delete {articlePendingDelete.type === 'pdf' ? 'PDF' : 'article'}?
              </h3>
              <p className="text-sm text-gray-400 mt-2">
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
                onClick={closeDeleteModal}
                disabled={Boolean(deletingId)}
                className="px-4 py-2 rounded-lg border border-gray-600 text-gray-200 hover:bg-gray-800 transition disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(articlePendingDelete.id)}
                disabled={deletingId === articlePendingDelete.id}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 transition disabled:opacity-40 flex items-center gap-2"
              >
                {deletingId === articlePendingDelete.id ? (
                  <>
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
