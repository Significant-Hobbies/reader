'use client';

import { Loader2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { ANNOTATABLE_SELECTOR } from '../../lib/annotatable';
import type { Article, ElementAnchor } from '../../types';

interface ElementPickerPanelProps {
  articleId: string;
  websiteNodeId: string;
  onClose: () => void;
  onAddNote: (anchor: ElementAnchor, elementText: string) => void;
  onAskAI: (anchor: ElementAnchor, elementText: string) => void;
}

type ActionMenuState = {
  x: number;
  y: number;
  anchor: ElementAnchor;
  elementText: string;
};

export function ElementPickerPanel({
  articleId,
  websiteNodeId,
  onClose,
  onAddNote,
  onAskAI,
}: ElementPickerPanelProps) {
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMenu, setActionMenu] = useState<ActionMenuState | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const annotatableRef = useRef<HTMLElement[]>([]);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/articles/${articleId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch article');
        return res.json();
      })
      .then((data: Article) => {
        if (!cancelled) setArticle(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [articleId]);

  const initAnnotatableElements = useCallback(() => {
    const root = contentRef.current;
    if (!root) return;

    const elements = Array.from(root.querySelectorAll<HTMLElement>(ANNOTATABLE_SELECTOR));
    annotatableRef.current = elements;

    elements.forEach((el, index) => {
      el.dataset.pickerIndex = String(index);
      el.classList.add('element-picker-target');
    });
  }, []);

  useEffect(() => {
    if (article) {
      requestAnimationFrame(initAnnotatableElements);
    }
  }, [article, initAnnotatableElements]);

  const handleElementClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>('[data-picker-index]');
      if (!target) {
        setActionMenu(null);
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const elementIndex = Number(target.dataset.pickerIndex);
      const tagName = target.tagName.toLowerCase();
      const textPreview = target.textContent?.trim().replace(/\s+/g, ' ').slice(0, 200) || '';

      setActionMenu({
        x: e.clientX,
        y: e.clientY,
        anchor: { articleId, websiteNodeId, elementIndex, tagName, textPreview },
        elementText: textPreview,
      });
    },
    [articleId, websiteNodeId]
  );

  const handleAddNote = useCallback(() => {
    if (!actionMenu) return;
    onAddNote(actionMenu.anchor, actionMenu.elementText);
    setActionMenu(null);
  }, [actionMenu, onAddNote]);

  const handleAskAI = useCallback(() => {
    if (!actionMenu) return;
    onAskAI(actionMenu.anchor, actionMenu.elementText);
    setActionMenu(null);
  }, [actionMenu, onAskAI]);

  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (actionMenu) {
          setActionMenu(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [actionMenu, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 z-50 flex h-full w-[480px] max-w-[90vw] flex-col border-l border-gray-700 bg-gray-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-white">
              {article?.title || 'Loading...'}
            </h3>
            <p className="text-xs text-gray-500">Click an element to add a note or ask AI</p>
          </div>
          <button
            onClick={onClose}
            className="ml-2 rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
            </div>
          )}
          {error && <div className="px-4 py-10 text-center text-sm text-red-400">{error}</div>}
          {article && (
            <div
              ref={contentRef}
              onClick={handleElementClick}
              className="element-picker-content prose prose-invert prose-sm max-w-none px-6 py-4"
              dangerouslySetInnerHTML={{ __html: article.content }}
            />
          )}
        </div>
      </div>

      {/* Action Menu */}
      {actionMenu &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed z-[120] min-w-[180px] rounded-xl border border-gray-700 bg-gray-950/95 p-1 shadow-2xl backdrop-blur"
            style={{
              left: Math.min(actionMenu.x, window.innerWidth - 200),
              top: Math.min(actionMenu.y, window.innerHeight - 120),
            }}
          >
            <button
              type="button"
              onClick={handleAddNote}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-100 transition-colors hover:bg-gray-800"
            >
              Add note
            </button>
            <button
              type="button"
              onClick={handleAskAI}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-100 transition-colors hover:bg-gray-800"
            >
              Ask AI
            </button>
          </div>,
          document.body
        )}
    </>
  );
}
