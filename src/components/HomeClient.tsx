'use client';

import {
  Badge as ThemeBadge,
  Box,
  Button as ThemeButton,
  Card,
  Flex,
  Heading,
  SegmentedControl,
  Text,
} from '@radix-ui/themes';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Clock,
  ExternalLink,
  FileText,
  Heart,
  LayoutDashboard,
  type LucideIcon,
  MoreVertical,
  Plus,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type MouseEvent, useState } from 'react';

import { trackActivatedOnce, trackCoreAction } from '../lib/analytics';
import {
  addLocalArticleToList,
  createLocalList,
  deleteLocalArticle,
  deleteLocalList,
  estimateReadingTimeFromHtml,
  fileToDataUrl,
  getLocalArticles,
  getLocalLists,
  getLocalTags,
  removeLocalArticleFromList,
  saveLocalArticle,
  updateLocalStatus,
} from '../lib/local-library';
import { formatReadingTime } from '../lib/reading-time-utils';
import { getTagColor } from '../lib/tag-utils';
import { formatDate } from '../lib/utils';
import type { ArticleStatus, ArticleSummary, List } from '../types';
import { AddArticleDialog } from './AddArticleDialog';
import { useAuth } from './AuthProvider';
import { Navbar } from './Navbar';
import { ReviewPackBanner } from './ReviewPackBanner';
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

type ContentFilter = 'all' | 'imported' | 'links' | 'pdfs';

const contentFilters: Array<{ id: ContentFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'imported', label: 'Imported' },
  { id: 'links', label: 'Links' },
  { id: 'pdfs', label: 'PDFs' },
];

function getArticleKind(article: ArticleSummary): {
  label: string;
  description: string;
  icon: LucideIcon;
  primaryAction: string;
} {
  if (article.type === 'link') {
    return {
      label: 'Link',
      description: 'Read outside',
      icon: ExternalLink,
      primaryAction: 'Open original',
    };
  }
  if (article.type === 'pdf') {
    return {
      label: 'PDF',
      description: 'Imported document',
      icon: FileText,
      primaryAction: 'Read PDF',
    };
  }
  return {
    label: 'Article',
    description: 'Imported article',
    icon: BookOpen,
    primaryAction: 'Read in Reader',
  };
}

function getArticleOrigin(article: ArticleSummary) {
  if (article.type === 'pdf') return 'Stored PDF';

  try {
    return new URL(article.url).hostname.replace(/^www\./, '');
  } catch {
    return article.url;
  }
}

function formatFileSize(bytes?: number) {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function getContextLine(article: ArticleSummary) {
  if (article.type === 'link') {
    return `Outside link saved from ${getArticleOrigin(article)}`;
  }
  if (article.type === 'pdf') {
    const details = [
      article.pdfMetadata?.pageCount ? `${article.pdfMetadata.pageCount} pages` : null,
      formatFileSize(article.pdfMetadata?.fileSize),
    ].filter(Boolean);
    return details.length > 0 ? `Research PDF · ${details.join(' · ')}` : 'Research PDF';
  }
  return article.readingTimeMinutes
    ? `Reader article · ${formatReadingTime(article.readingTimeMinutes)}`
    : 'Reader article';
}

function LoadingLibrarySkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card
          key={index}
          className="border border-l-2 border-[var(--gray-5)] border-l-[var(--gray-6)] bg-[var(--gray-2)]/75 p-0"
        >
          <div className="space-y-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 animate-pulse rounded-md bg-white/10" />
                <div className="h-3 w-28 animate-pulse rounded-full bg-white/10" />
              </div>
              <div className="h-5 w-14 animate-pulse rounded-full bg-white/10" />
            </div>
            <div className="space-y-2">
              <div className="h-5 w-11/12 animate-pulse rounded-full bg-white/15" />
              <div className="h-5 w-7/12 animate-pulse rounded-full bg-white/10" />
            </div>
            <div className="flex gap-2">
              <div className="h-5 w-16 animate-pulse rounded-full bg-white/10" />
              <div className="h-5 w-20 animate-pulse rounded-full bg-white/10" />
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--gray-5)] px-5 py-3">
            <div className="h-8 w-24 animate-pulse rounded-md bg-white/10" />
            <div className="h-3 w-20 animate-pulse rounded-full bg-white/10" />
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function HomeClient() {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeToolbarId, setActiveToolbarId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [selectedListId, setSelectedListId] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all');
  const [newListName, setNewListName] = useState('');
  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [showAddArticleDialog, setShowAddArticleDialog] = useState(false);

  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const isLocalMode = !authLoading && !user;
  const dataMode = isLocalMode ? 'local' : 'cloud';
  const articleQueryKey = ['articles', dataMode] as const;

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
    queryKey: articleQueryKey,
    queryFn: async () => {
      if (isLocalMode) {
        const localArticles = await getLocalArticles();
        return localArticles.map((article) => ({
          ...article,
          notesCount: article.notesCount ?? article.notes?.length ?? 0,
        }));
      }

      const response = await fetch('/api/articles', { cache: 'no-store' });
      if (!response.ok) {
        const err = new Error('Failed to fetch articles');
        (err as Error & { status: number }).status = response.status;
        throw err;
      }
      return response.json();
    },
    enabled: !authLoading,
  });

  const { data: lists = [], error: listsError } = useQuery<List[]>({
    queryKey: ['lists', dataMode],
    queryFn: async () => {
      if (isLocalMode) {
        return getLocalLists();
      }

      const response = await fetch('/api/lists', { cache: 'no-store' });
      if (!response.ok) {
        const err = new Error('Failed to fetch lists');
        (err as Error & { status: number }).status = response.status;
        throw err;
      }
      return response.json();
    },
    enabled: !authLoading,
  });

  const { data: allTags = [] } = useQuery<string[]>({
    queryKey: ['tags', dataMode],
    queryFn: async () => {
      if (isLocalMode) {
        return getLocalTags();
      }

      const response = await fetch('/api/tags', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to fetch tags');
      }
      const data = await response.json();
      return data.tags;
    },
    enabled: !authLoading,
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

      if (isLocalMode) {
        const saved = await saveLocalArticle({
          url: properUrl,
          title: snapshotTitle,
          byline: article.byline,
          content: article.content,
          type: 'article',
          listIds: selectedListId !== 'all' ? [selectedListId] : [],
          category,
          readingTimeMinutes: estimateReadingTimeFromHtml(article.content),
        });
        return saved.id;
      }

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
      // Analytics — core action: a source was saved. `activated` once.
      trackActivatedOnce();
      trackCoreAction('source_saved');
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      setShowAddArticleDialog(false);
    },
  });

  const pdfUploadMutation = useMutation({
    mutationFn: async ({ file, category }: { file: File; category?: string }) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('listIds', JSON.stringify(selectedListId !== 'all' ? [selectedListId] : []));
      if (category) {
        formData.append('category', category);
      }

      if (isLocalMode) {
        const pdfDataUrl = await fileToDataUrl(file);
        const saved = await saveLocalArticle({
          url: `local-pdf://${file.name}`,
          title: file.name.replace(/\.pdf$/i, '') || file.name,
          byline: null,
          content: `<p>${file.name}</p>`,
          type: 'pdf',
          pdfUrl: pdfDataUrl,
          pdfDataUrl,
          listIds: selectedListId !== 'all' ? [selectedListId] : [],
          category,
          pdfMetadata: {
            fileSize: file.size,
          },
        });
        return saved.id;
      }

      const response = await fetch('/api/pdf/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to import PDF');
      }

      const data = await response.json();
      return data.id as string;
    },
    onSuccess: () => {
      // Analytics — core action: a PDF source was saved. `activated` once.
      trackActivatedOnce();
      trackCoreAction('source_saved');
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      setShowAddArticleDialog(false);
    },
  });

  const saveLinkMutation = useMutation({
    mutationFn: async ({
      url: rawUrl,
      title,
      category,
    }: {
      url: string;
      title?: string;
      category?: string;
    }) => {
      let properUrl = rawUrl;
      if (!/^https?:\/\//i.test(rawUrl)) {
        properUrl = `https://${rawUrl}`;
      }

      if (isLocalMode) {
        return saveLocalArticle({
          url: properUrl,
          title: title?.trim() || properUrl,
          content: '',
          type: 'link',
          listIds: selectedListId !== 'all' ? [selectedListId] : [],
          category,
        });
      }

      const response = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: properUrl,
          title: title?.trim() || properUrl,
          content: '',
          type: 'link',
          listIds: selectedListId !== 'all' ? [selectedListId] : [],
          category,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save link');
      }

      return response.json();
    },
    onSuccess: () => {
      // Analytics — core action: a link source was saved. `activated` once.
      trackActivatedOnce();
      trackCoreAction('source_saved');
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      setShowAddArticleDialog(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (articleId: string) => {
      if (isLocalMode) {
        await deleteLocalArticle(articleId);
        return;
      }

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

  const handleSaveLink = async (url: string, title?: string, category?: string) => {
    try {
      await saveLinkMutation.mutateAsync({ url, title, category });
    } catch (error) {
      console.error('Save link failed:', error);
      throw error;
    }
  };

  const isImporting =
    importMutation.isPending || pdfUploadMutation.isPending || saveLinkMutation.isPending;

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ArticleStatus }) => {
      if (isLocalMode) {
        await updateLocalStatus(id, status);
        return { id, status };
      }

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
      if (isLocalMode) {
        queryClient.invalidateQueries({ queryKey: ['articles'] });
        return;
      }

      queryClient.setQueryData<ArticleSummary[]>(articleQueryKey, (prev) =>
        Array.isArray(prev)
          ? prev.map((article) => (article.id === id ? { ...article, status } : article))
          : prev
      );
    },
  });

  const createListMutation = useMutation({
    mutationFn: async (name: string) => {
      if (isLocalMode) {
        await createLocalList(name);
        return;
      }

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
      if (isLocalMode) {
        await deleteLocalList(listId);
        return;
      }

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
      if (isLocalMode) {
        await addLocalArticleToList(articleId, listId);
        return { articleId, listId };
      }

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
      if (isLocalMode) {
        queryClient.invalidateQueries({ queryKey: ['articles'] });
        return;
      }

      queryClient.setQueryData<ArticleSummary[]>(articleQueryKey, (prev) =>
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
      if (isLocalMode) {
        await removeLocalArticleFromList(articleId, listId);
        return { articleId, listId };
      }

      const response = await fetch(`/api/articles/${articleId}/lists?listId=${listId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to remove from list');
      }
      return { articleId, listId };
    },
    onSuccess: ({ articleId, listId }) => {
      if (isLocalMode) {
        queryClient.invalidateQueries({ queryKey: ['articles'] });
        return;
      }

      queryClient.setQueryData<ArticleSummary[]>(articleQueryKey, (prev) =>
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
    .filter((article) => {
      if (contentFilter === 'all') return true;
      if (contentFilter === 'imported') return article.type !== 'link';
      if (contentFilter === 'links') return article.type === 'link';
      return article.type === 'pdf';
    })
    .filter((article) => (selectedTag ? article.tags?.includes(selectedTag) : true));

  const filterCounts = {
    all: articles.length,
    imported: articles.filter((article) => article.type !== 'link').length,
    links: articles.filter((article) => article.type === 'link').length,
    pdfs: articles.filter((article) => article.type === 'pdf').length,
  };

  const activeListName =
    selectedListId === 'all' ? 'Library' : lists.find((l) => l.id === selectedListId)?.name;
  const unreadCount = articles.filter((article) => article.status !== 'read').length;
  const notesCount = articles.reduce((total, article) => total + article.notesCount, 0);
  const readCount = articles.length - unreadCount;
  const unreadMinutes = articles
    .filter((article) => article.status !== 'read')
    .reduce((sum, article) => sum + (article.readingTimeMinutes ?? 0), 0);
  const nextUnreadArticle =
    articles.find((article) => article.status !== 'read' && article.type !== 'link') ??
    articles.find((article) => article.status !== 'read');

  return (
    <div className="min-h-screen bg-[#0d0d0c] font-sans text-gray-100">
      <Navbar />
      <div className="flex">
        {/* Sidebar for Lists */}
        <aside className="sticky top-[65px] hidden h-[calc(100vh-65px)] w-[16rem] shrink-0 space-y-4 overflow-y-auto border-r border-white/10 bg-[#101010]/90 p-5 backdrop-blur-xl lg:block">
          <div className="mb-6">
            <h3 className="mb-3 text-sm font-medium tracking-wide text-gray-500 uppercase">
              Navigate
            </h3>
            <Link
              href="/"
              className="flex w-full items-center gap-3 rounded-md border border-[var(--accent-7)] bg-[var(--accent-4)] px-3 py-2 text-sm font-medium text-[var(--accent-12)] shadow-[0_8px_24px_rgba(168,124,75,0.12)]"
            >
              <FileText size={18} />
              Library
            </Link>
            <Link
              href="/board"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-[var(--gray-11)] transition-colors hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]"
            >
              <LayoutDashboard size={18} />
              Boards
            </Link>
          </div>
          <div className="mb-4 border-t border-[var(--gray-5)]" />
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-sm font-medium tracking-wide text-gray-500 uppercase">Library</h3>
            <Dialog open={isListModalOpen} onOpenChange={setIsListModalOpen}>
              <DialogTrigger asChild>
                <ThemeButton size="1" variant="outline" className="h-7 gap-1 px-2 text-xs">
                  <Plus className="h-3.5 w-3.5" />
                  New
                </ThemeButton>
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
            className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              selectedListId === 'all'
                ? 'bg-[var(--accent-4)] text-[var(--accent-12)]'
                : 'text-[var(--gray-11)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]'
            }`}
          >
            <FileText size={18} />
            All Items
          </button>

          {/* Default Lists */}
          {lists
            .filter((list) => list.isDefault)
            .map((list) => (
              <button
                key={list.id}
                onClick={() => setSelectedListId(list.id)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  selectedListId === list.id
                    ? 'bg-[var(--accent-4)] text-[var(--accent-12)]'
                    : 'text-[var(--gray-11)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]'
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
              <div className="my-4 border-t border-[var(--gray-5)]" />
              {lists
                .filter((list) => !list.isDefault)
                .map((list) => (
                  <div key={list.id} className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedListId(list.id)}
                      className={`flex flex-1 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        selectedListId === list.id
                          ? 'bg-[var(--accent-4)] text-[var(--accent-12)]'
                          : 'text-[var(--gray-11)] hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)]'
                      }`}
                    >
                      <div className="h-2 w-2 rounded-full bg-gray-500" />
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
        <div className="min-w-0 flex-1 p-5 sm:p-8">
          <div className="mx-auto max-w-6xl space-y-6">
            <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0">
                <Heading
                  as="h1"
                  size="7"
                  weight="bold"
                  className="text-balance text-[var(--gray-12)]"
                >
                  {activeListName || 'Library'}
                </Heading>
                <Text as="p" size="2" color="gray" className="mt-1.5">
                  {articles.length === 0
                    ? 'Save links, import articles, and read PDFs in one place.'
                    : `${articles.length} ${articles.length === 1 ? 'source' : 'sources'}${
                        unreadCount > 0 ? ` · ${unreadCount} unread` : ''
                      }${notesCount > 0 ? ` · ${notesCount} ${notesCount === 1 ? 'note' : 'notes'}` : ''}`}
                </Text>
                {isLocalMode && (
                  <ThemeBadge color="bronze" variant="surface" className="mt-3">
                    Local only on this browser
                  </ThemeBadge>
                )}
              </div>

              {articles.length > 0 && (
                <ThemeButton
                  size="3"
                  onClick={() => setShowAddArticleDialog(true)}
                  className="shrink-0 gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Source
                </ThemeButton>
              )}
            </header>

            {articles.length > 0 && (
              <div className="rounded-xl border border-[var(--gray-5)] bg-[var(--gray-2)]/50 px-5 py-4">
                <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
                  <div>
                    <Text size="1" color="gray" className="tracking-wide uppercase">
                      Read
                    </Text>
                    <div className="mt-0.5 flex items-baseline gap-1">
                      <Text size="5" weight="bold" className="text-[var(--gray-12)]">
                        {readCount}
                      </Text>
                      <Text size="2" color="gray">
                        / {articles.length}
                      </Text>
                    </div>
                  </div>
                  <div>
                    <Text size="1" color="gray" className="tracking-wide uppercase">
                      Highlights
                    </Text>
                    <Text size="5" weight="bold" className="mt-0.5 block text-[var(--gray-12)]">
                      {notesCount}
                    </Text>
                  </div>
                  {unreadMinutes > 0 && (
                    <div>
                      <Text size="1" color="gray" className="tracking-wide uppercase">
                        Left to read
                      </Text>
                      <Text size="5" weight="bold" className="mt-0.5 block text-[var(--gray-12)]">
                        {unreadMinutes < 60
                          ? `${unreadMinutes} min`
                          : `${Math.floor(unreadMinutes / 60)} hr${unreadMinutes % 60 > 0 ? ` ${unreadMinutes % 60} min` : ''}`}
                      </Text>
                    </div>
                  )}
                  {nextUnreadArticle && (
                    <div className="ml-auto">
                      <Link
                        href={
                          nextUnreadArticle.type === 'link'
                            ? nextUnreadArticle.url
                            : `/reader/${nextUnreadArticle.id}`
                        }
                        target={nextUnreadArticle.type === 'link' ? '_blank' : undefined}
                        rel={nextUnreadArticle.type === 'link' ? 'noopener noreferrer' : undefined}
                      >
                        <ThemeButton size="2" variant="soft" className="gap-1.5">
                          <BookOpen className="h-3.5 w-3.5" />
                          Continue reading
                        </ThemeButton>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            )}

            {articles.length > 0 && <ReviewPackBanner />}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <SegmentedControl.Root
                value={contentFilter}
                onValueChange={(value) => setContentFilter(value as ContentFilter)}
                size="2"
              >
                {contentFilters.map((filter) => (
                  <SegmentedControl.Item key={filter.id} value={filter.id}>
                    {filter.label}
                    <span className="ml-1.5 text-[var(--gray-10)]">{filterCounts[filter.id]}</span>
                  </SegmentedControl.Item>
                ))}
              </SegmentedControl.Root>
              {(selectedTag || contentFilter !== 'all' || selectedListId !== 'all') && (
                <button
                  onClick={() => {
                    setSelectedListId('all');
                    setSelectedTag(null);
                    setContentFilter('all');
                  }}
                  className="text-xs text-[var(--gray-11)] underline-offset-2 transition-colors hover:text-[var(--gray-12)] hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>

            {allTags.length > 0 && (
              <div className="-mx-2 flex flex-nowrap items-center gap-2 overflow-x-auto px-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <Text
                  as="span"
                  size="1"
                  weight="medium"
                  color="gray"
                  className="shrink-0 tracking-wide uppercase"
                >
                  Tags
                </Text>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all ${
                      selectedTag === tag
                        ? 'ring-1 ring-[var(--accent-9)] ring-offset-1 ring-offset-[#0d0d0c]'
                        : ''
                    } ${getTagColor(tag)} hover:opacity-80`}
                  >
                    {tag}
                    {selectedTag === tag && <X className="ml-1 h-3 w-3" />}
                  </button>
                ))}
              </div>
            )}

            {articlesError && (
              <div className="mb-6 rounded-md border border-red-800 bg-red-950/80 px-4 py-3 text-red-200">
                Failed to load articles. Please try again.
              </div>
            )}

            {authLoading || isLoading ? (
              <LoadingLibrarySkeleton />
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {articles.length === 0 ? (
                  <Card className="col-span-full border border-dashed border-[var(--gray-6)] bg-[var(--gray-2)]/70 p-0">
                    <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-16 text-center">
                      {/* Sample doc artifact — proof of the core read/annotate loop */}
                      <div className="mb-8 w-full overflow-hidden rounded-xl border border-[var(--accent-6)]/40 bg-[var(--gray-1)] text-left shadow-md">
                        <div className="px-5 py-4">
                          <Text
                            as="p"
                            size="1"
                            weight="medium"
                            className="mb-2 tracking-widest text-[var(--accent-11)] uppercase"
                          >
                            Sample article · 4 min read
                          </Text>
                          <Text
                            as="p"
                            size="3"
                            weight="bold"
                            className="mb-3 leading-snug text-[var(--gray-12)]"
                          >
                            How to Learn Anything Fast
                          </Text>
                          <Text as="p" size="2" color="gray" className="leading-relaxed">
                            The best way to learn is to teach.{' '}
                            <span className="rounded-sm bg-[var(--accent-4)] px-0.5 text-[var(--gray-12)]">
                              When you explain it simply, you find the gaps.
                            </span>{' '}
                            That&apos;s when real understanding kicks in.
                          </Text>
                          <div className="mt-3 flex items-center gap-3">
                            <Text size="1" color="gray">
                              3 highlights
                            </Text>
                            <Text size="1" color="gray">
                              ·
                            </Text>
                            <Text size="1" color="gray">
                              2 notes
                            </Text>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 border-t border-[var(--gray-4)] bg-[var(--gray-2)] px-5 py-3">
                          <Link href="/sample">
                            <ThemeButton size="2" className="gap-1.5">
                              <BookOpen className="h-3.5 w-3.5" />
                              Try sample doc
                            </ThemeButton>
                          </Link>
                        </div>
                      </div>

                      <Heading
                        as="h1"
                        size="7"
                        weight="bold"
                        className="text-balance text-[var(--gray-12)]"
                      >
                        Your library is empty
                      </Heading>
                      <Text as="p" size="3" color="gray" className="mt-3 max-w-md">
                        Save articles, PDFs, and links to read and annotate in one place.
                      </Text>
                      <ol className="mt-6 w-full max-w-sm space-y-3 text-left">
                        {[
                          {
                            title: 'Paste a URL',
                            body: 'Drop any article link into Add Source — we strip the clutter.',
                          },
                          {
                            title: 'Read distraction-free',
                            body: 'Open it in the focused reader view, your way.',
                          },
                          {
                            title: 'Highlight & annotate',
                            body: 'Select text to capture quotes and add personal notes.',
                          },
                        ].map((step, index) => (
                          <li
                            key={step.title}
                            className="flex items-start gap-3 rounded-lg border border-[var(--gray-5)] bg-[var(--gray-1)]/60 px-3 py-2.5"
                          >
                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--accent-6)] bg-[var(--accent-3)] text-xs font-semibold text-[var(--accent-11)]">
                              {index + 1}
                            </span>
                            <div>
                              <Text
                                as="p"
                                size="2"
                                weight="medium"
                                className="text-[var(--gray-12)]"
                              >
                                {step.title}
                              </Text>
                              <Text as="p" size="1" color="gray" className="mt-0.5">
                                {step.body}
                              </Text>
                            </div>
                          </li>
                        ))}
                      </ol>
                      <ThemeButton
                        size="3"
                        onClick={() => setShowAddArticleDialog(true)}
                        className="mt-6 gap-2"
                      >
                        <Plus className="h-4 w-4" />
                        Add your first source
                      </ThemeButton>
                    </div>
                  </Card>
                ) : filteredArticles.length === 0 ? (
                  <Card className="col-span-full border border-dashed border-[var(--gray-6)] bg-[var(--gray-2)]/70 p-0">
                    <div className="mx-auto flex max-w-xl flex-col items-center px-6 py-16 text-center">
                      <Text as="p" size="2" weight="medium" color="gray" className="mb-2 uppercase">
                        No matching sources
                      </Text>
                      <Heading as="h2" size="5" weight="medium" className="text-[var(--gray-12)]">
                        Nothing matches this view
                      </Heading>
                      <Text as="p" size="3" color="gray" className="mt-3">
                        Adjust the type, list, or tag filters to bring sources back into view.
                      </Text>
                      <ThemeButton
                        variant="soft"
                        className="mt-6"
                        onClick={() => {
                          setSelectedListId('all');
                          setSelectedTag(null);
                          setContentFilter('all');
                        }}
                      >
                        Clear all filters
                      </ThemeButton>
                    </div>
                  </Card>
                ) : (
                  filteredArticles.map((article) => {
                    const nextStatus: ArticleStatus =
                      article.status === 'read' ? 'in_progress' : 'read';
                    const displayTitle = article.title || article.url;
                    const isPDF = article.type === 'pdf';
                    const isLink = article.type === 'link';
                    const kind = getArticleKind(article);
                    const KindIcon = kind.icon;
                    const origin = getArticleOrigin(article);
                    const contextLine = isLink ? null : getContextLine(article);
                    const attachedLists = lists.filter((list) =>
                      article.listIds?.includes(list.id)
                    );
                    const hasMetadata =
                      (!isLink && Boolean(article.readingTimeMinutes)) ||
                      (isPDF && Boolean(article.pdfMetadata?.pageCount)) ||
                      (isPDF && Boolean(formatFileSize(article.pdfMetadata?.fileSize))) ||
                      article.notesCount > 0;
                    const cardTone = isLink
                      ? 'border-l-2 border-l-[var(--gray-6)]'
                      : isPDF
                        ? 'border-l-2 border-l-[var(--accent-8)]'
                        : 'border-l-2 border-l-[var(--accent-6)]/60';
                    return (
                      <Card
                        asChild
                        key={article.id}
                        className={`group border border-[var(--gray-5)] bg-[var(--gray-2)]/75 p-0 transition-colors duration-150 hover:border-[var(--gray-7)] hover:bg-[var(--gray-3)]/85 ${cardTone}`}
                      >
                        <article
                          onClick={(event) => {
                            if (!isLink) {
                              handleArticleCardClick(event, article.id);
                              return;
                            }
                            if (event.defaultPrevented) return;
                            const target = event.target;
                            if (
                              target instanceof HTMLElement &&
                              target.closest(
                                'button, a, input, textarea, select, [role="menuitem"]'
                              )
                            ) {
                              return;
                            }
                            window.open(article.url, '_blank', 'noopener,noreferrer');
                          }}
                          className="flex h-full cursor-pointer flex-col overflow-hidden rounded-[inherit]"
                        >
                          <div className="flex flex-1 flex-col gap-4 p-5">
                            <Flex align="center" justify="between" gap="3">
                              <Flex align="center" gap="2" className="min-w-0">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[var(--gray-6)] bg-[var(--gray-3)] text-[var(--accent-11)]">
                                  <KindIcon className="h-4 w-4" />
                                </div>
                                <Box className="min-w-0">
                                  <Text
                                    as="p"
                                    size="2"
                                    weight="medium"
                                    color="gray"
                                    className="truncate"
                                    title={`${kind.label} · ${origin}`}
                                  >
                                    {kind.label} · {origin}
                                  </Text>
                                </Box>
                              </Flex>
                              <ThemeBadge color="gray" variant="soft" className="shrink-0">
                                {article.status === 'read'
                                  ? isLink
                                    ? 'Done'
                                    : 'Read'
                                  : isLink
                                    ? 'Pending'
                                    : 'Unread'}
                              </ThemeBadge>
                            </Flex>

                            <div className="flex items-start gap-2">
                              <div className="min-w-0 flex-1 pr-2">
                                <Heading
                                  as="h2"
                                  size="4"
                                  weight="medium"
                                  className="line-clamp-2 break-words text-[var(--gray-12)]"
                                  title={displayTitle}
                                >
                                  {displayTitle}
                                </Heading>
                                {contextLine && (
                                  <Text
                                    as="p"
                                    size="2"
                                    color="gray"
                                    className="mt-2 line-clamp-2"
                                    title={contextLine}
                                  >
                                    {contextLine}
                                  </Text>
                                )}
                                {hasMetadata && (
                                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-300">
                                    {!isLink && article.readingTimeMinutes && (
                                      <ThemeBadge color="gray" variant="surface" className="gap-1">
                                        <Clock className="h-3 w-3" />
                                        {formatReadingTime(article.readingTimeMinutes)}
                                      </ThemeBadge>
                                    )}
                                    {isPDF && article.pdfMetadata?.pageCount && (
                                      <ThemeBadge color="gray" variant="surface">
                                        {article.pdfMetadata.pageCount} pages
                                      </ThemeBadge>
                                    )}
                                    {isPDF && formatFileSize(article.pdfMetadata?.fileSize) && (
                                      <ThemeBadge color="gray" variant="surface">
                                        {formatFileSize(article.pdfMetadata?.fileSize)}
                                      </ThemeBadge>
                                    )}
                                    {article.notesCount > 0 && (
                                      <ThemeBadge color="gray" variant="surface">
                                        {article.notesCount} notes
                                      </ThemeBadge>
                                    )}
                                  </div>
                                )}
                                {(article.category ||
                                  attachedLists.length > 0 ||
                                  Boolean(article.tags?.length)) && (
                                  <div className="mt-3 flex flex-wrap gap-1.5">
                                    {article.category && (
                                      <ThemeBadge
                                        color="gray"
                                        variant="surface"
                                        className="max-w-[9rem] truncate"
                                        title={article.category}
                                      >
                                        {article.category}
                                      </ThemeBadge>
                                    )}
                                    {attachedLists.slice(0, 2).map((list) => (
                                      <ThemeBadge
                                        key={list.id}
                                        color="gray"
                                        variant="soft"
                                        className="max-w-[8rem] truncate"
                                        title={list.name}
                                      >
                                        {list.name}
                                      </ThemeBadge>
                                    ))}
                                    {(article.tags ?? []).map((tag) => (
                                      <button
                                        key={tag}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedTag(tag);
                                        }}
                                        className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium transition-colors ${getTagColor(tag)} hover:opacity-80`}
                                      >
                                        {tag}
                                      </button>
                                    ))}
                                    {attachedLists.length > 2 && (
                                      <ThemeBadge color="gray" variant="soft">
                                        +{attachedLists.length - 2}
                                      </ThemeBadge>
                                    )}
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
                                    className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-[var(--gray-3)] hover:text-white"
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
                                    {article.status === 'read'
                                      ? isLink
                                        ? 'Mark Pending'
                                        : 'Mark In Progress'
                                      : isLink
                                        ? 'Mark Done'
                                        : 'Mark Read'}
                                  </DropdownMenuItem>
                                  {isLink && (
                                    <DropdownMenuItem
                                      onSelect={() => {
                                        window.open(article.url, '_blank', 'noopener,noreferrer');
                                      }}
                                    >
                                      Open Link
                                    </DropdownMenuItem>
                                  )}
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
                                              <div className="mr-2 h-2 w-2 rounded-full bg-gray-500" />
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
                                                <div className="mr-2 h-2 w-2 rounded-full bg-gray-500" />
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
                          <Flex
                            align="center"
                            justify="between"
                            gap="3"
                            wrap="wrap"
                            className="border-t border-[var(--gray-5)] bg-[var(--gray-1)]/40 px-5 py-3"
                          >
                            <Flex align="center" gap="2">
                              <ThemeButton
                                size="1"
                                variant={isLink ? 'solid' : 'soft'}
                                className="h-8 gap-1.5 px-3 text-xs"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (isLink) {
                                    window.open(article.url, '_blank', 'noopener,noreferrer');
                                    return;
                                  }
                                  router.push(`/reader/${article.id}`);
                                }}
                              >
                                {isLink ? (
                                  <ExternalLink className="h-3.5 w-3.5" />
                                ) : (
                                  <BookOpen className="h-3.5 w-3.5" />
                                )}
                                {kind.primaryAction}
                              </ThemeButton>
                              {!isLink && (
                                <ThemeButton
                                  size="1"
                                  variant="ghost"
                                  className="h-8 gap-1.5 px-2 text-xs"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    toggleStatus.mutate({ id: article.id, status: nextStatus });
                                  }}
                                >
                                  {article.status === 'read' ? 'Mark unread' : 'Mark read'}
                                </ThemeButton>
                              )}
                            </Flex>
                            <Text as="span" size="1" color="gray">
                              {formatDate(article.createdAt)}
                            </Text>
                          </Flex>
                        </article>
                      </Card>
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
        onSaveLink={handleSaveLink}
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
            className="relative mx-4 w-full max-w-md space-y-4 rounded-lg border border-[var(--gray-6)] bg-[var(--gray-2)] p-6 shadow-2xl"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div>
              <h3 className="text-xl font-semibold text-white">
                Delete{' '}
                {articlePendingDelete.type === 'pdf'
                  ? 'PDF'
                  : articlePendingDelete.type === 'link'
                    ? 'saved link'
                    : 'article'}
                ?
              </h3>
              <p className="mt-2 text-sm text-gray-400">
                {articlePendingDelete.title || articlePendingDelete.url}
              </p>
            </div>
            <p className="text-sm text-gray-500">
              This removes the{' '}
              {articlePendingDelete.type === 'pdf'
                ? 'PDF'
                : articlePendingDelete.type === 'link'
                  ? 'saved link'
                  : 'article'}{' '}
              and all of its notes permanently. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  closeDeleteModal();
                }}
                disabled={Boolean(deletingId)}
                className="rounded-md border border-[var(--gray-6)] px-4 py-2 text-gray-200 transition hover:bg-[var(--gray-3)] disabled:opacity-40"
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
                className="flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-white transition hover:bg-red-500 disabled:opacity-40"
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
