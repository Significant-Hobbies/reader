'use client';

import { SegmentedControl } from '@radix-ui/themes';
import { BookmarkPlus, BookOpen, FileText, Link as LinkIcon, Loader2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';

import { SUGGESTED_CATEGORIES } from '@/lib/category-utils';

import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface AddArticleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitUrl: (url: string, category?: string) => Promise<void>;
  onSaveLink: (url: string, title?: string, category?: string) => Promise<void>;
  onUploadPDF: (file: File, category?: string) => Promise<void>;
  isSubmitting?: boolean;
  uploadProgress?: number | null;
}

export function AddArticleDialog({
  open,
  onOpenChange,
  onSubmitUrl,
  onSaveLink,
  onUploadPDF,
  isSubmitting = false,
}: AddArticleDialogProps) {
  const [tab, setTab] = useState<'url' | 'link' | 'pdf'>('url');
  const [url, setUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [category, setCategory] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || isSubmitting) return;
    setError(null);

    try {
      await onSubmitUrl(url, category || undefined);
      setUrl('');
      setCategory('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import article');
    }
  };

  const handleLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || isSubmitting) return;
    setError(null);

    try {
      await onSaveLink(url, linkTitle || undefined, category || undefined);
      setUrl('');
      setLinkTitle('');
      setCategory('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save link');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.type !== 'application/pdf') {
      setError('Please select a PDF file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('PDF file size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
  };

  const handlePDFSubmit = async () => {
    if (!selectedFile || isSubmitting) return;
    setError(null);

    try {
      await onUploadPDF(selectedFile, category || undefined);
      setCategory('');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process PDF');
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      onOpenChange(newOpen);
      if (!newOpen) {
        setUrl('');
        setLinkTitle('');
        setCategory('');
        setSelectedFile(null);
        setError(null);
        setTab('url');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    }
  };

  const modeCopy = {
    url: {
      eyebrow: 'Import',
      title: 'Readable article',
      description: 'Extract the article and keep it inside Reader for annotation.',
      icon: BookOpen,
    },
    link: {
      eyebrow: 'Save',
      title: 'Outside link',
      description: 'Keep a future reading, product, or reference link without importing it.',
      icon: BookmarkPlus,
    },
    pdf: {
      eyebrow: 'Upload',
      title: 'Research PDF',
      description: 'Store the original PDF and open it directly in Reader.',
      icon: FileText,
    },
  } as const;

  const ActiveModeIcon = modeCopy[tab].icon;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto border-[var(--gray-5)] bg-[#171511] p-0 sm:max-w-[620px]">
        <DialogHeader className="border-b border-[var(--gray-5)] bg-[var(--gray-2)]/80 px-6 pt-6 pb-5">
          <div className="flex items-start gap-3 pr-8">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--gray-6)] bg-[var(--gray-3)] text-[var(--accent-11)]">
              <ActiveModeIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium tracking-wide text-[var(--accent-11)] uppercase">
                {modeCopy[tab].eyebrow}
              </p>
              <DialogTitle className="text-2xl text-[var(--gray-12)]">Add to Library</DialogTitle>
              <p className="mt-2 max-w-[28rem] text-sm leading-6 text-[var(--gray-10)]">
                {modeCopy[tab].description}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 px-6 pt-5 pb-6">
          <SegmentedControl.Root
            value={tab}
            onValueChange={(value) => {
              setTab(value as 'url' | 'link' | 'pdf');
              setError(null);
            }}
            size="3"
            className="w-full"
          >
            <SegmentedControl.Item value="url">
              <span className="flex items-center gap-2">
                <LinkIcon size={16} />
                Import
              </span>
            </SegmentedControl.Item>
            <SegmentedControl.Item value="link">
              <span className="flex items-center gap-2">
                <BookmarkPlus size={16} />
                Link
              </span>
            </SegmentedControl.Item>
            <SegmentedControl.Item value="pdf">
              <span className="flex items-center gap-2">
                <Upload size={16} />
                PDF
              </span>
            </SegmentedControl.Item>
          </SegmentedControl.Root>

          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.entries(modeCopy) as Array<[typeof tab, (typeof modeCopy)[typeof tab]]>).map(
              ([mode, copy]) => {
                const ModeIcon = copy.icon;
                const isActive = tab === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setTab(mode);
                      setError(null);
                    }}
                    className={`rounded-lg border p-3 text-left transition ${
                      isActive
                        ? 'border-[var(--accent-7)] bg-[var(--accent-3)] text-[var(--gray-12)]'
                        : 'border-[var(--gray-5)] bg-[var(--gray-2)]/70 text-[var(--gray-10)] hover:border-[var(--gray-7)] hover:bg-[var(--gray-3)]'
                    }`}
                  >
                    <ModeIcon
                      className={`mb-2 h-4 w-4 ${isActive ? 'text-[var(--accent-11)]' : 'text-[var(--gray-9)]'}`}
                    />
                    <p className="text-sm font-medium text-[var(--gray-12)]">{copy.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--gray-10)]">
                      {copy.description}
                    </p>
                  </button>
                );
              }
            )}
          </div>

          {error && (
            <div className="rounded-md border border-red-800 bg-red-950/80 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* URL Import Tab */}
          {tab === 'url' && (
            <form onSubmit={handleUrlSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="url">Article URL</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://example.com/article-to-import"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
                <p className="text-xs leading-5 text-[var(--gray-9)]">
                  Reader will fetch a clean article view and keep annotations in your library.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="category-url">Category (optional)</Label>
                <Input
                  id="category-url"
                  placeholder="e.g. Research, Tutorial, Blog Post"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={isSubmitting}
                  list="category-suggestions"
                  maxLength={50}
                />
                <datalist id="category-suggestions">
                  {SUGGESTED_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>

              <div className="flex justify-end gap-2 border-t border-[var(--gray-5)] pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!url || isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing...
                    </>
                  ) : (
                    'Import to Reader'
                  )}
                </Button>
              </div>
            </form>
          )}

          {tab === 'link' && (
            <form onSubmit={handleLinkSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="link-url">Link URL</Label>
                <Input
                  id="link-url"
                  type="url"
                  placeholder="https://example.com/read-outside"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={isSubmitting}
                  required
                />
                <p className="text-xs leading-5 text-[var(--gray-9)]">
                  Links stay outside Reader. Use this for future reading, products, tools, and
                  references.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="link-title">Title (optional)</Label>
                <Input
                  id="link-title"
                  placeholder="e.g. Blog to read, product to try"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  disabled={isSubmitting}
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category-link">Category (optional)</Label>
                <Input
                  id="category-link"
                  placeholder="e.g. Papers, Products, Future Reading"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={isSubmitting}
                  list="category-suggestions-link"
                  maxLength={50}
                />
                <datalist id="category-suggestions-link">
                  {SUGGESTED_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>

              <div className="flex justify-end gap-2 border-t border-[var(--gray-5)] pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!url || isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    'Save outside link'
                  )}
                </Button>
              </div>
            </form>
          )}

          {/* PDF Upload Tab */}
          {tab === 'pdf' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category-pdf">Category (optional)</Label>
                <Input
                  id="category-pdf"
                  placeholder="e.g. Research, Tutorial, Documentation"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={isSubmitting}
                  list="category-suggestions-pdf"
                  maxLength={50}
                />
                <datalist id="category-suggestions-pdf">
                  {SUGGESTED_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pdf-file">PDF File</Label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting}
                  className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-[var(--gray-6)] bg-[var(--gray-2)]/70 px-5 py-7 text-center transition hover:border-[var(--accent-7)] hover:bg-[var(--gray-3)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Upload className="mb-3 h-6 w-6 text-[var(--accent-11)]" />
                  <span className="text-sm font-medium text-[var(--gray-12)]">
                    Choose a research PDF
                  </span>
                  <span className="mt-1 text-xs text-[var(--gray-9)]">
                    Stored locally or in your cloud library depending on sign-in state.
                  </span>
                </button>
                <input
                  id="pdf-file"
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileSelect}
                  disabled={isSubmitting}
                  className="hidden"
                />
                {selectedFile && (
                  <div className="flex items-center gap-2 rounded-md border border-[var(--gray-6)] bg-[var(--gray-2)] px-3 py-2">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <span className="flex-1 truncate text-sm text-gray-300">
                      {selectedFile.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                  </div>
                )}
                <p className="text-xs text-gray-500">
                  Maximum file size: 10MB. The PDF is stored as-is and rendered directly.
                </p>
              </div>

              <div className="flex justify-end gap-2 border-t border-[var(--gray-5)] pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => void handlePDFSubmit()}
                  disabled={!selectedFile || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" /> Import PDF
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
