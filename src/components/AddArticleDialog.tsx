'use client';

import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { SUGGESTED_CATEGORIES } from '@/lib/category-utils';
import { Upload, Link as LinkIcon, FileText, Loader2 } from 'lucide-react';

interface AddArticleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitUrl: (url: string, category?: string) => Promise<void>;
  onUploadPDF: (file: File, category?: string) => Promise<void>;
  isSubmitting?: boolean;
  uploadProgress?: number | null;
}

export function AddArticleDialog({
  open,
  onOpenChange,
  onSubmitUrl,
  onUploadPDF,
  isSubmitting = false,
}: AddArticleDialogProps) {
  const [tab, setTab] = useState<'url' | 'pdf'>('url');
  const [url, setUrl] = useState('');
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Content</DialogTitle>
          <p className="text-sm text-gray-400">Import articles or upload documents</p>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-700">
          <button
            onClick={() => {
              setTab('url');
              setError(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'url'
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <LinkIcon size={16} />
            Import URL
          </button>
          <button
            onClick={() => {
              setTab('pdf');
              setError(null);
            }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'pdf'
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <Upload size={16} />
            Upload PDF
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-800 bg-red-950/80 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* URL Import Tab */}
        {tab === 'url' && (
          <form onSubmit={handleUrlSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="url">Article URL</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://example.com/article"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isSubmitting}
                required
              />
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

            <div className="flex justify-end gap-2 pt-2">
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
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Importing...
                  </>
                ) : (
                  'Import'
                )}
              </Button>
            </div>
          </form>
        )}

        {/* PDF Upload Tab */}
        {tab === 'pdf' && (
          <div className="space-y-4 pt-2">
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
              <Input
                id="pdf-file"
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleFileSelect}
                disabled={isSubmitting}
                className="cursor-pointer"
              />
              {selectedFile && (
                <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900/60 px-3 py-2">
                  <FileText className="h-4 w-4 text-blue-400" />
                  <span className="text-sm text-gray-300 truncate flex-1">{selectedFile.name}</span>
                  <span className="text-xs text-gray-500">
                    {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                </div>
              )}
              <p className="text-xs text-gray-500">
                Maximum file size: 10MB. Text is extracted in your browser.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
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
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Processing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" /> Upload
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
