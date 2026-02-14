'use client';

import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { formatDate } from '../lib/utils';
import { formatReadingTime } from '../lib/reading-time-utils';
import { ArticleSummary, ArticleStatus, Project } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from './ui/select';
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
import { MoreVertical, X, Clock, FileText, Upload } from 'lucide-react';
import { Navbar } from './Navbar';
import { getTagColor } from '../lib/tag-utils';

export default function HomeClient() {
  const [url, setUrl] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeToolbarId, setActiveToolbarId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const {
    data: projects = [],
    isLoading: isProjectsLoading,
    error: projectsError,
  } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await fetch('/api/projects', { cache: 'no-store' });
      if (!response.ok) {
        const err = new Error('Failed to fetch projects');
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
    mutationFn: async (rawUrl: string) => {
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
          projectId: selectedProjectId === 'all' ? undefined : selectedProjectId,
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
    },
  });

  const pdfUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      if (selectedProjectId !== 'all') {
        formData.append('projectId', selectedProjectId);
      }

      setUploadProgress(0);

      const response = await fetch('/api/pdf/upload', {
        method: 'POST',
        body: formData,
      });

      setUploadProgress(null);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to upload PDF');
      }

      const data = await response.json();
      return data.id as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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

  const handleImport = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!url || importMutation.isPending) return;

    try {
      const newArticleId = await importMutation.mutateAsync(url);
      setUrl('');
      router.push(`/reader/${newArticleId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import article';
      console.error(error);
      alert(message);
    }
  };

  const handlePDFUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('PDF file size must be less than 10MB');
      return;
    }

    try {
      const newArticleId = await pdfUploadMutation.mutateAsync(file);
      router.push(`/reader/${newArticleId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to upload PDF';
      console.error(error);
      alert(message);
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

  const createProjectMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        throw new Error('Failed to create project');
      }
    },
    onSuccess: () => {
      setNewProjectName('');
      setIsProjectModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete project');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      setSelectedProjectId('all');
    },
  });

  const moveProjectMutation = useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const response = await fetch(`/api/articles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      if (!response.ok) {
        throw new Error('Failed to move article');
      }
      return { id, projectId };
    },
    onSuccess: ({ id, projectId }) => {
      queryClient.setQueryData<ArticleSummary[]>(['articles'], (prev) =>
        Array.isArray(prev)
          ? prev.map((article) =>
              article.id === id
                ? {
                    ...article,
                    projectId,
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
      selectedProjectId === 'all' ? true : article.projectId === selectedProjectId
    )
    .filter((article) => (selectedTag ? article.tags?.includes(selectedTag) : true));

  const projectOptions = [{ id: 'all', name: 'All projects' }, ...(projects || [])];
  const moveTargets = (projects || []).filter((p) => p.id !== 'all');

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-gray-950 to-gray-900 font-sans text-gray-100">
      <Navbar />
      <div className="p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">My Library</h1>
              <p className="text-gray-400 mt-1">Manage your annotated articles and PDFs</p>
            </div>

            <div className="w-full md:w-auto bg-gray-900/70 border border-gray-800 rounded-xl p-4 shadow-lg backdrop-blur">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs uppercase tracking-wide text-gray-500">Project</span>
                <Select
                  value={selectedProjectId}
                  onValueChange={(value) => setSelectedProjectId(value)}
                  disabled={isProjectsLoading}
                >
                  <SelectTrigger className="w-48 md:w-56">
                    <SelectValue placeholder="All projects" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectOptions.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {projectsError && (
                  <span className="text-xs text-red-400">Failed to load projects</span>
                )}
                <Dialog open={isProjectModalOpen} onOpenChange={setIsProjectModalOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">+ New</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create project</DialogTitle>
                      <p className="text-sm text-gray-400">
                        Organize your articles into a project.
                      </p>
                    </DialogHeader>
                    <form
                      className="space-y-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!newProjectName.trim() || createProjectMutation.isPending) return;
                        createProjectMutation.mutate(newProjectName.trim());
                      }}
                    >
                      <div className="space-y-2">
                        <Label htmlFor="project-name">Project name</Label>
                        <Input
                          id="project-name"
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                          placeholder="e.g. Research, Inspiration"
                          autoFocus
                        />
                      </div>
                      <DialogFooter className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          type="button"
                          onClick={() => setIsProjectModalOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createProjectMutation.isPending}>
                          {createProjectMutation.isPending ? 'Creating…' : 'Create'}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
                {selectedProjectId !== 'all' && selectedProjectId !== 'default' && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteProjectMutation.mutate(selectedProjectId)}
                    disabled={deleteProjectMutation.isPending}
                  >
                    {deleteProjectMutation.isPending ? 'Deleting…' : 'Delete'}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {allTags.length > 0 && (
            <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4 shadow-lg backdrop-blur">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs uppercase tracking-wide text-gray-500">Filter by tag</span>
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

          <div className="bg-gray-900/80 p-6 rounded-2xl shadow-2xl border border-gray-800 mb-8 backdrop-blur">
            <h2 className="text-lg font-semibold text-white mb-4">Add New Content</h2>

            <form onSubmit={handleImport} className="flex flex-col gap-4 mb-4">
              <div className="flex flex-col md:flex-row gap-4">
                <Input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Enter website URL (e.g. https://example.com/article)"
                  className="flex-grow"
                  disabled={isImporting}
                />
                <Button
                  type="submit"
                  className="px-6 py-3 font-medium flex items-center gap-2 whitespace-nowrap"
                  disabled={isImporting}
                >
                  {importMutation.isPending ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Importing...
                    </>
                  ) : (
                    <>
                      <span>+</span> Import URL
                    </>
                  )}
                </Button>
              </div>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-700"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-900/80 text-gray-500">or</span>
              </div>
            </div>

            <div className="mt-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handlePDFUpload}
                className="hidden"
                id="pdf-upload"
                disabled={isImporting}
              />
              <label htmlFor="pdf-upload">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={isImporting}
                  onClick={() => fileInputRef.current?.click()}
                  asChild
                >
                  <div className="cursor-pointer">
                    {pdfUploadMutation.isPending ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                        Uploading PDF...
                        {uploadProgress !== null && (
                          <span className="ml-2">({uploadProgress}%)</span>
                        )}
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload PDF
                      </>
                    )}
                  </div>
                </Button>
              </label>
            </div>
          </div>

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
                      setSelectedProjectId('all');
                      setSelectedTag(null);
                    }}
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Clear all filters
                  </button>
                </div>
              ) : (
                filteredArticles.map((article) => {
                  const projectName =
                    projects.find((project) => project.id === article.projectId)?.name || 'Default';
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
                        <div className="flex items-start gap-2">
                          <div className="flex-1 pr-2 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <h2
                                className="text-xl font-semibold text-white line-clamp-2 break-words group-hover:text-blue-300 transition-colors flex-1"
                                title={displayTitle}
                              >
                                {displayTitle}
                              </h2>
                              {isPDF && (
                                <FileText className="h-5 w-5 text-blue-400 flex-shrink-0" />
                              )}
                            </div>
                            <p className="text-sm text-gray-400 truncate" title={article.url}>
                              {isPDF ? 'PDF Document' : article.url}
                            </p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-300 flex-wrap">
                              <Badge variant="default">{projectName}</Badge>
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
                            onOpenChange={(open) => setActiveToolbarId(open ? article.id : null)}
                          >
                            <DropdownMenuTrigger asChild>
                              <button
                                onClick={(e) => e.stopPropagation()}
                                aria-label="Article actions"
                                className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem
                                onSelect={() => {
                                  toggleStatus.mutate({ id: article.id, status: nextStatus });
                                }}
                              >
                                {article.status === 'read' ? 'Mark In Progress' : 'Mark Read'}
                              </DropdownMenuItem>
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger>Move to</DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                  {moveTargets.map((project) => (
                                    <DropdownMenuItem
                                      key={project.id}
                                      onSelect={() =>
                                        moveProjectMutation.mutate({
                                          id: article.id,
                                          projectId: project.id,
                                        })
                                      }
                                    >
                                      {project.name}
                                      {(article.projectId || 'default') === project.id && (
                                        <span className="ml-auto text-xs text-gray-500">
                                          current
                                        </span>
                                      )}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
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
