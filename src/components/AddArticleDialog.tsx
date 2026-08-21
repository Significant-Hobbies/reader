'use client';

import { BookmarkPlus, BookOpen, FileText, Link as LinkIcon, Loader2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';

import { SUGGESTED_CATEGORIES } from '@/lib/category-utils';

import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { SegmentedControl } from './ui/segmented-control';
import { Input } from './ui/input';
import { Label } from './ui/label';

export type AddArticleMode = 'url' | 'link' | 'pdf';

interface AddArticleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitUrl: (url: string, category?: string) => Promise<void>;
  onSaveLink: (url: string, title?: string, category?: string) => Promise<void>;
  onUploadPDF: (file: File, category?: string) => Promise<void>;
  initialMode?: AddArticleMode;
  isSubmitting?: boolean;
  uploadProgress?: number | null;
}

const MODE_COPY = {
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

function CategoryInput({
  id,
  value,
  onChange,
  disabled,
  placeholder,
  datalistId,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  placeholder: string;
  datalistId: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Category (optional)</Label>
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        list={datalistId}
        maxLength={50}
      />
      <datalist id={datalistId}>
        {SUGGESTED_CATEGORIES.map((cat) => (
          <option key={cat} value={cat} />
        ))}
      </datalist>
    </div>
  );
}

function DialogFooter({
  isSubmitting,
  onCancel,
  submitLabel,
  submittingLabel,
  submitIcon,
  disabled,
}: {
  isSubmitting: boolean;
  onCancel: () => void;
  submitLabel: string;
  submittingLabel: string;
  submitIcon?: React.ReactNode;
  disabled: boolean;
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-[var(--gray-5)] pt-4">
      <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
        Cancel
      </Button>
      <Button type="submit" disabled={disabled}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {submittingLabel}
          </>
        ) : (
          <>
            {submitIcon}
            {submitLabel}
          </>
        )}
      </Button>
    </div>
  );
}

function UrlImportForm({
  url,
  setUrl,
  categoryState,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  url: string;
  setUrl: (v: string) => void;
  categoryState: { value: string; onChange: (v: string) => void };
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
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

      <CategoryInput
        id="category-url"
        value={categoryState.value}
        onChange={categoryState.onChange}
        disabled={isSubmitting}
        placeholder="e.g. Research, Tutorial, Blog Post"
        datalistId="category-suggestions"
      />

      <DialogFooter
        isSubmitting={isSubmitting}
        onCancel={onCancel}
        submitLabel="Import to Reader"
        submittingLabel="Importing..."
        disabled={!url || isSubmitting}
      />
    </form>
  );
}

function LinkSaveForm({
  url,
  setUrl,
  linkTitle,
  setLinkTitle,
  category,
  setCategory,
  isSubmitting,
  onSubmit,
  onCancel,
}: {
  url: string;
  setUrl: (v: string) => void;
  linkTitle: string;
  setLinkTitle: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
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
          Links stay outside Reader. Use this for future reading, products, tools, and references.
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

      <CategoryInput
        id="category-link"
        value={category}
        onChange={setCategory}
        disabled={isSubmitting}
        placeholder="e.g. Papers, Products, Future Reading"
        datalistId="category-suggestions-link"
      />

      <DialogFooter
        isSubmitting={isSubmitting}
        onCancel={onCancel}
        submitLabel="Save outside link"
        submittingLabel="Saving..."
        disabled={!url || isSubmitting}
      />
    </form>
  );
}

function PdfUploadForm({
  category,
  setCategory,
  selectedFile,
  setSelectedFile,
  isSubmitting,
  onSubmit,
  onCancel,
  fileInputRef,
  onError,
}: {
  category: string;
  setCategory: (v: string) => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  isSubmitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onError: (error: string) => void;
}) {
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      onError('Please select a PDF file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      onError('PDF file size must be less than 10MB');
      return;
    }
    setSelectedFile(file);
  };

  return (
    <div className="space-y-4">
      <CategoryInput
        id="category-pdf"
        value={category}
        onChange={setCategory}
        disabled={isSubmitting}
        placeholder="e.g. Research, Tutorial, Documentation"
        datalistId="category-suggestions-pdf"
      />

      <div className="space-y-2">
        <Label htmlFor="pdf-file">PDF File</Label>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isSubmitting}
          className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-[var(--gray-6)] bg-[var(--gray-2)]/70 px-5 py-7 text-center transition hover:border-[var(--accent-7)] hover:bg-[var(--gray-3)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Upload className="mb-3 h-6 w-6 text-[var(--accent-11)]" />
          <span className="text-sm font-medium text-[var(--gray-12)]">Choose a research PDF</span>
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
            <span className="flex-1 truncate text-sm text-gray-300">{selectedFile.name}</span>
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
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button onClick={onSubmit} disabled={!selectedFile || isSubmitting}>
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
  );
}

export function AddArticleDialog({
  open,
  onOpenChange,
  onSubmitUrl,
  onSaveLink,
  onUploadPDF,
  initialMode = 'url',
  isSubmitting = false,
}: AddArticleDialogProps) {
  const [tab, setTab] = useState<AddArticleMode>(initialMode);
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
        setTab(initialMode);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    }
  };

  const ActiveModeIcon = MODE_COPY[tab].icon;

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
                {MODE_COPY[tab].eyebrow}
              </p>
              <DialogTitle className="text-2xl text-[var(--gray-12)]">Add to Library</DialogTitle>
              <p className="mt-2 max-w-[28rem] text-sm leading-6 text-[var(--gray-10)]">
                {MODE_COPY[tab].description}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 px-6 pt-5 pb-6">
          <SegmentedControl
            value={tab}
            onValueChange={(value) => {
              setTab(value as AddArticleMode);
              setError(null);
            }}
            className="w-full"
            options={[
              {
                value: 'url',
                label: (
                  <span className="flex items-center gap-2">
                    <LinkIcon size={16} />
                    Import
                  </span>
                ),
              },
              {
                value: 'link',
                label: (
                  <span className="flex items-center gap-2">
                    <BookmarkPlus size={16} />
                    Link
                  </span>
                ),
              },
              {
                value: 'pdf',
                label: (
                  <span className="flex items-center gap-2">
                    <Upload size={16} />
                    PDF
                  </span>
                ),
              },
            ]}
          />

          <div className="grid gap-2 sm:grid-cols-3">
            {(
              Object.entries(MODE_COPY) as Array<
                [AddArticleMode, (typeof MODE_COPY)[AddArticleMode]]
              >
            ).map(([mode, copy]) => {
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
            })}
          </div>

          {error && (
            <div className="rounded-md border border-red-800 bg-red-950/80 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          {tab === 'url' && (
            <UrlImportForm
              url={url}
              setUrl={setUrl}
              categoryState={{ value: category, onChange: setCategory }}
              isSubmitting={isSubmitting}
              onSubmit={handleUrlSubmit}
              onCancel={() => handleOpenChange(false)}
            />
          )}

          {tab === 'link' && (
            <LinkSaveForm
              url={url}
              setUrl={setUrl}
              linkTitle={linkTitle}
              setLinkTitle={setLinkTitle}
              category={category}
              setCategory={setCategory}
              isSubmitting={isSubmitting}
              onSubmit={handleLinkSubmit}
              onCancel={() => handleOpenChange(false)}
            />
          )}

          {tab === 'pdf' && (
            <PdfUploadForm
              category={category}
              setCategory={setCategory}
              selectedFile={selectedFile}
              setSelectedFile={setSelectedFile}
              isSubmitting={isSubmitting}
              onSubmit={() => void handlePDFSubmit()}
              onCancel={() => handleOpenChange(false)}
              fileInputRef={fileInputRef}
              onError={setError}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
