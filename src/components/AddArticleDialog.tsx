'use client';

import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { SUGGESTED_CATEGORIES } from '@/lib/category-utils';
import { Upload, Link as LinkIcon } from 'lucide-react';

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
  uploadProgress = null,
}: AddArticleDialogProps) {
  const [tab, setTab] = useState<'url' | 'pdf'>('url');
  const [url, setUrl] = useState('');
  const [category, setCategory] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || isSubmitting) return;

    try {
      await onSubmitUrl(url, category || undefined);
      // Reset form
      setUrl('');
      setCategory('');
    } catch (error) {
      // Error handling is done by parent component
      console.error('Error submitting URL:', error);
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
      await onUploadPDF(file, category || undefined);
      // Reset form
      setCategory('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      // Error handling is done by parent component
      console.error('Error uploading PDF:', error);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isSubmitting) {
      onOpenChange(newOpen);
      if (!newOpen) {
        // Reset form when closing
        setUrl('');
        setCategory('');
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
            onClick={() => setTab('url')}
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
            onClick={() => setTab('pdf')}
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

        {/* URL Import Tab */}
        {tab === 'url' && (
          <form onSubmit={handleUrlSubmit} className="space-y-4 pt-4">
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
              <p className="text-xs text-gray-500">
                Add a category to organize your content (e.g., Research, Tutorial, Blog Post)
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
              <Button type="submit" disabled={!url || isSubmitting}>
                {isSubmitting ? 'Importing...' : 'Import'}
              </Button>
            </div>
          </form>
        )}

        {/* PDF Upload Tab */}
        {tab === 'pdf' && (
          <div className="space-y-4 pt-4">
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
              <div className="flex items-center gap-2">
                <Input
                  id="pdf-file"
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handlePDFUpload}
                  disabled={isSubmitting}
                  className="cursor-pointer"
                />
              </div>
              <p className="text-xs text-gray-500">Maximum file size: 10MB</p>
            </div>

            {uploadProgress !== null && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-400">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-700">
                  <div
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
