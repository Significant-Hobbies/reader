'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { AIConfig } from '../../lib/ai-config';
import { AI_CONFIG_STORAGE_KEY, DEFAULT_AI_CONFIG } from '../../lib/ai-config';
import { ANNOTATABLE_SELECTOR } from '../../lib/annotatable';
import type { Article, ElementAnchor, Note, ReaderSettings } from '../../types';
import { AppearanceToolbar } from '../AppearanceToolbar';
import { ArticleSummary } from '../ArticleSummary';
import { ArticleTagEditor } from '../ArticleTagEditor';
import { NotesAIChat } from '../NotesAIChat';
import { getThemeClasses, ReaderView } from '../ReaderView';
import { NoteCard } from './NoteCard';
import { NoteMarkerGroupMemo } from './NoteMarkerGroup';

// ---------------------------------------------------------------------------
// Constants & types
// ---------------------------------------------------------------------------

const SCROLL_OFFSET = 80;
const MAX_SELECTION_MENU_TEXT = 600;

type SelectionActionMenuState = {
  x: number;
  y: number;
  text: string;
  anchor?: Note['anchor'];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const loadAIConfig = (): AIConfig => {
  if (typeof window === 'undefined') return DEFAULT_AI_CONFIG;

  try {
    const raw = window.localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_AI_CONFIG;

    const parsed = JSON.parse(raw) as Partial<AIConfig>;
    return {
      endpointUrl: typeof parsed.endpointUrl === 'string' ? parsed.endpointUrl.trim() : '',
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
      model: typeof parsed.model === 'string' ? parsed.model.trim() : '',
    };
  } catch {
    return DEFAULT_AI_CONFIG;
  }
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ReaderCoreProps {
  article: Article;
  readOnly?: boolean;
  onSpawnNote?: (anchor: ElementAnchor, text: string) => void;
  onSpawnAIChat?: (anchor: ElementAnchor, text: string) => void;
  compact?: boolean;
  headerActions?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// ReaderCore
// ---------------------------------------------------------------------------

export function ReaderCore({
  article,
  readOnly = false,
  onSpawnNote,
  onSpawnAIChat,
  compact = false,
  headerActions,
}: ReaderCoreProps) {
  const id = article.id;
  const queryClient = useQueryClient();

  // ---- State ----
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'notes' | 'ai' | 'tags'>('notes');
  const [titleDraft, setTitleDraft] = useState('');
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [selectionMenu, setSelectionMenu] = useState<SelectionActionMenuState | null>(null);
  const [queuedAIPrompt, setQueuedAIPrompt] = useState<string | null>(null);
  const [aiConfig] = useState<AIConfig>(() => loadAIConfig());

  // Layout
  const [leftPanelWidth, setLeftPanelWidth] = useState(66.66);
  const isDraggingRef = useRef(false);

  // Sidebar visibility for compact mode
  const [showSidebar, setShowSidebar] = useState(!compact);

  // Settings
  const [settings, setSettings] = useState<ReaderSettings>({
    fontSize: 'medium',
    theme: 'dark',
    fontFamily: 'sans',
  });

  // Refs
  const snapshotContainerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const annotatableElementsRef = useRef<HTMLElement[]>([]);
  const markerRefs = useRef<Map<number, HTMLElement>>(new Map());
  const draggingNoteIdRef = useRef<number | null>(null);
  const dragMovedRef = useRef(false);
  const ignoreMarkerClickRef = useRef(false);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);
  const dragAnimationFrameRef = useRef<number | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);
  const [annotatableElements, setAnnotatableElements] = useState<HTMLElement[]>([]);
  const hasInitializedNotesRef = useRef(false);
  const nextNoteIdRef = useRef<number>(0);
  const lastArticleIdRef = useRef<string | null>(null);

  // ---- Mutations (skipped in readOnly mode) ----

  const { mutate: persistNotes, isPending: isNotesSaving } = useMutation({
    mutationFn: async (updatedNotes: Note[]) => {
      if (readOnly) return updatedNotes;
      const response = await fetch(`/api/articles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: updatedNotes }),
      });
      if (!response.ok) {
        throw new Error('Failed to save notes');
      }
      return updatedNotes;
    },
    onSuccess: (updatedNotes) => {
      if (readOnly) return;
      queryClient.setQueryData<Article>(['article', id], (prev) =>
        prev ? { ...prev, notes: updatedNotes, notesCount: updatedNotes.length } : prev
      );
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });

  const {
    mutate: persistTitle,
    isPending: isTitleSaving,
    isError: isTitleError,
    error: titleMutationError,
    reset: resetTitleMutation,
  } = useMutation({
    mutationFn: async (newTitle: string) => {
      if (readOnly) return newTitle;
      const response = await fetch(`/api/articles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
      if (!response.ok) {
        throw new Error('Failed to update title');
      }
      return newTitle;
    },
    onSuccess: (newTitle) => {
      if (readOnly) return;
      queryClient.setQueryData<Article>(['article', id], (prev) =>
        prev ? { ...prev, title: newTitle } : prev
      );
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });

  // ---- Effects ----

  // Initialize notes from article
  useEffect(() => {
    if (!article) return;
    if (article.id === lastArticleIdRef.current) return;
    lastArticleIdRef.current = article.id;

    startTransition(() => {
      setNotes(article.notes ?? []);
      setTitleDraft(article.title || article.url || '');
      setIsTitleEditing(false);
    });

    const maxExistingId = (article.notes ?? []).reduce(
      (max, note) => (typeof note.id === 'number' ? Math.max(max, note.id) : max),
      0
    );
    nextNoteIdRef.current = maxExistingId;
    hasInitializedNotesRef.current = false;
  }, [article]);

  // Debounced title save
  useEffect(() => {
    if (readOnly) return;
    if (!article || !id) return;
    const trimmedDraft = titleDraft.trim();
    const currentTitle = (article.title || '').trim();
    if (!trimmedDraft || trimmedDraft === currentTitle) return;

    const timeoutId = setTimeout(() => {
      persistTitle(trimmedDraft);
    }, 600);

    return () => clearTimeout(timeoutId);
  }, [titleDraft, article, id, persistTitle, readOnly]);

  // Debounced note save
  useEffect(() => {
    if (readOnly) return;
    if (!id) return;
    if (!hasInitializedNotesRef.current) {
      hasInitializedNotesRef.current = true;
      return;
    }

    const timeoutId = setTimeout(() => {
      persistNotes(notes);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [notes, id, persistNotes, readOnly]);

  // Annotation target refresh
  const refreshAnnotationTargets = useCallback(() => {
    const root = contentRef.current;
    if (!root) return;

    root.querySelectorAll<HTMLElement>('[data-note-anchor-index]').forEach((el) => {
      el.removeAttribute('data-note-anchor-index');
      el.classList.remove('annotation-target');
    });

    const elements = Array.from(root.querySelectorAll<HTMLElement>(ANNOTATABLE_SELECTOR)).filter(
      (el) => !el.classList.contains('annotation-mount')
    );
    annotatableElementsRef.current = elements;
    setAnnotatableElements(elements);

    elements.forEach((el, index) => {
      el.dataset.noteAnchorIndex = String(index);
      el.classList.add('annotation-target');
    });
  }, []);

  useEffect(() => {
    refreshAnnotationTargets();
  }, [
    article?.id,
    article?.content,
    settings.fontSize,
    settings.fontFamily,
    settings.theme,
    refreshAnnotationTargets,
  ]);

  useEffect(() => {
    refreshAnnotationTargets();
  }, [notes, refreshAnnotationTargets]);

  // Selection menu dismiss
  useEffect(() => {
    const dismissSelectionMenu = (event?: Event) => {
      const target = event?.target;
      if (target instanceof Element && target.closest('[data-selection-actions-menu="true"]')) {
        return;
      }
      setSelectionMenu(null);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectionMenu(null);
      }
    };

    window.addEventListener('scroll', dismissSelectionMenu, true);
    window.addEventListener('resize', dismissSelectionMenu);
    window.addEventListener('mousedown', dismissSelectionMenu);
    window.addEventListener('keydown', dismissOnEscape);

    return () => {
      window.removeEventListener('scroll', dismissSelectionMenu, true);
      window.removeEventListener('resize', dismissSelectionMenu);
      window.removeEventListener('mousedown', dismissSelectionMenu);
      window.removeEventListener('keydown', dismissOnEscape);
    };
  }, []);

  // Resizing Logic
  useEffect(() => {
    if (compact) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;

      const newWidth = (e.clientX / window.innerWidth) * 100;
      if (newWidth > 20 && newWidth < 80) {
        setLeftPanelWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [compact]);

  // ---- Callbacks ----

  const startResizing = () => {
    isDraggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const getAnchorElementFromPoint = useCallback(
    (clientX: number, clientY: number) => {
      if (!annotatableElementsRef.current.length) {
        refreshAnnotationTargets();
      }

      const hitElements = document.elementsFromPoint(clientX, clientY);
      const directMatch = hitElements.find(
        (el) =>
          el instanceof HTMLElement &&
          typeof (el as HTMLElement).dataset.noteAnchorIndex === 'string' &&
          contentRef.current?.contains(el)
      ) as HTMLElement | undefined;
      if (directMatch) return directMatch;

      let closest: { element: HTMLElement; distance: number } | null = null;

      for (const element of annotatableElementsRef.current) {
        const rect = element.getBoundingClientRect();
        const dx = Math.max(rect.left - clientX, 0, clientX - rect.right);
        const dy = Math.max(rect.top - clientY, 0, clientY - rect.bottom);
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (!closest || distance < closest.distance) {
          closest = { element, distance };
        }
      }

      return closest?.element ?? null;
    },
    [refreshAnnotationTargets]
  );

  const buildAnchorPayload = useCallback((anchorElement: HTMLElement) => {
    const anchorIndex = Number(anchorElement.dataset.noteAnchorIndex);
    return {
      elementIndex: Number.isFinite(anchorIndex) ? anchorIndex : 0,
      tagName: anchorElement.tagName.toLowerCase(),
      textPreview:
        anchorElement.textContent?.trim().replace(/\s+/g, ' ').slice(0, 200) || undefined,
    };
  }, []);

  const createNote = useCallback((text = '', anchor?: Note['anchor']) => {
    nextNoteIdRef.current += 1;
    const noteId = nextNoteIdRef.current;
    const newNote: Note = {
      id: noteId,
      text,
      anchor,
    };
    setNotes((prev) => [...prev, newNote]);
  }, []);

  const openSelectionActionsMenu = useCallback(
    (clientX: number, clientY: number) => {
      if (readOnly) return false;

      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        setSelectionMenu(null);
        return false;
      }

      const range = selection.getRangeAt(0);
      const commonNode =
        range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
          ? (range.commonAncestorContainer as Element)
          : range.commonAncestorContainer.parentElement;

      if (!commonNode || !contentRef.current?.contains(commonNode)) {
        setSelectionMenu(null);
        return false;
      }

      const selectedText = selection
        .toString()
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, MAX_SELECTION_MENU_TEXT);
      if (!selectedText) {
        setSelectionMenu(null);
        return false;
      }

      let x = clientX;
      let y = clientY;
      if (!Number.isFinite(x) || !Number.isFinite(y) || (x <= 0 && y <= 0)) {
        const rect = range.getBoundingClientRect();
        x = rect.right;
        y = rect.bottom;
      }

      const anchorElement =
        getAnchorElementFromPoint(x, y) ||
        (commonNode.closest?.('[data-note-anchor-index]') as HTMLElement | null);

      const anchorPayload = anchorElement
        ? {
            ...buildAnchorPayload(anchorElement),
            textPreview: selectedText.slice(0, 200),
          }
        : undefined;

      setSelectionMenu({
        x,
        y,
        text: selectedText,
        anchor: anchorPayload,
      });
      return true;
    },
    [buildAnchorPayload, getAnchorElementFromPoint, readOnly]
  );

  const handleSelectionMouseUp = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      openSelectionActionsMenu(event.clientX, event.clientY);
    },
    [openSelectionActionsMenu]
  );

  const handleSelectionContextMenu = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const opened = openSelectionActionsMenu(event.clientX, event.clientY);
      if (opened) {
        event.preventDefault();
      }
    },
    [openSelectionActionsMenu]
  );

  const addNoteFromSelection = useCallback(() => {
    if (!selectionMenu) return;
    createNote(selectionMenu.text, selectionMenu.anchor);
    setSelectionMenu(null);
  }, [createNote, selectionMenu]);

  const askAIFromSelection = useCallback(() => {
    if (!selectionMenu) return;
    const prompt = `Explain this selected excerpt in context:\n\n"${selectionMenu.text}"`;
    setActiveSidebarTab('ai');
    setQueuedAIPrompt(prompt);
    setSelectionMenu(null);
  }, [selectionMenu]);

  const spawnNoteFromSelection = useCallback(() => {
    if (!selectionMenu || !onSpawnNote) return;
    const anchor: ElementAnchor = {
      articleId: article.id,
      websiteNodeId: '',
      elementIndex: selectionMenu.anchor?.elementIndex ?? 0,
      tagName: selectionMenu.anchor?.tagName,
      textPreview: selectionMenu.text.slice(0, 200),
    };
    onSpawnNote(anchor, selectionMenu.text);
    setSelectionMenu(null);
  }, [selectionMenu, onSpawnNote, article.id]);

  const spawnAIChatFromSelection = useCallback(() => {
    if (!selectionMenu || !onSpawnAIChat) return;
    const anchor: ElementAnchor = {
      articleId: article.id,
      websiteNodeId: '',
      elementIndex: selectionMenu.anchor?.elementIndex ?? 0,
      tagName: selectionMenu.anchor?.tagName,
      textPreview: selectionMenu.text.slice(0, 200),
    };
    onSpawnAIChat(anchor, selectionMenu.text);
    setSelectionMenu(null);
  }, [selectionMenu, onSpawnAIChat, article.id]);

  const handleNoteChange = useCallback((noteId: number, text: string) => {
    setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, text } : n)));
  }, []);

  const handleDeleteNote = useCallback((noteId: number) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  }, []);

  const scrollToNote = useCallback(
    (note: Note) => {
      const container = snapshotContainerRef.current;
      if (!container) return;

      const markerEl = markerRefs.current.get(note.id);
      if (markerEl) {
        const markerRect = markerEl.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const scrollTarget =
          markerRect.top - containerRect.top + container.scrollTop - SCROLL_OFFSET;
        container.scrollTo({
          top: Math.max(scrollTarget, 0),
          behavior: 'smooth',
        });
        return;
      }

      if (!annotatableElementsRef.current.length) {
        refreshAnnotationTargets();
      }

      const anchorIndex = note.anchor?.elementIndex;
      const anchorElement =
        typeof anchorIndex === 'number' ? annotatableElementsRef.current[anchorIndex] : null;

      if (anchorElement) {
        const anchorRect = anchorElement.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const scrollTarget =
          anchorRect.top - containerRect.top + container.scrollTop - SCROLL_OFFSET;
        container.scrollTo({
          top: Math.max(scrollTarget, 0),
          behavior: 'smooth',
        });
      }
    },
    [refreshAnnotationTargets]
  );

  const updateSettings = (newSettings: Partial<ReaderSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const handleTitleBlur = () => {
    if (!titleDraft.trim() && article?.url) {
      setTitleDraft(article.url);
    }
    setIsTitleEditing(false);
  };

  const titleErrorMessage =
    titleMutationError instanceof Error ? titleMutationError.message : 'Failed to save title';

  const registerMarker = useCallback((noteId: number, el: HTMLElement | null) => {
    const map = markerRefs.current;
    if (el) {
      map.set(noteId, el);
    } else {
      map.delete(noteId);
    }
  }, []);

  const showTooltip = useCallback((text: string, e: React.MouseEvent | MouseEvent) => {
    setActiveTooltip({
      text,
      x: e.clientX + 12,
      y: e.clientY - 14,
    });
  }, []);

  const moveTooltip = useCallback((e: MouseEvent) => {
    setActiveTooltip((prev) => (prev ? { ...prev, x: e.clientX + 12, y: e.clientY - 14 } : prev));
  }, []);

  const hideTooltip = useCallback(() => {
    setActiveTooltip(null);
  }, []);

  const startMarkerDrag = useCallback(
    (note: Note, displayIndex: number) => (event: React.MouseEvent) => {
      if (readOnly) return;
      event.preventDefault();
      event.stopPropagation();
      hideTooltip();
      draggingNoteIdRef.current = note.id;
      dragMovedRef.current = false;
      const startX = event.clientX;
      const startY = event.clientY;

      const originalUserSelect = document.body.style.userSelect;
      const originalCursor = document.body.style.cursor;
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';

      if (!dragGhostRef.current && typeof document !== 'undefined') {
        const ghost = document.createElement('div');
        ghost.className = 'annotation-drag-ghost';
        dragGhostRef.current = ghost;
        document.body.appendChild(ghost);
      }

      const updateGhostPosition = (x: number, y: number) => {
        if (!dragGhostRef.current) return;
        dragGhostRef.current.style.left = `${x}px`;
        dragGhostRef.current.style.top = `${y}px`;
      };

      const scheduleGhostUpdate = (x: number, y: number) => {
        if (dragAnimationFrameRef.current) {
          cancelAnimationFrame(dragAnimationFrameRef.current);
        }
        dragAnimationFrameRef.current = requestAnimationFrame(() => updateGhostPosition(x, y));
      };

      if (dragGhostRef.current) {
        dragGhostRef.current.textContent = `${displayIndex + 1}`;
        updateGhostPosition(startX, startY);
      }

      const handleMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        if (!dragMovedRef.current && Math.hypot(dx, dy) > 1) {
          dragMovedRef.current = true;
        }
        scheduleGhostUpdate(moveEvent.clientX, moveEvent.clientY);
      };

      const handleUp = (upEvent: MouseEvent) => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
        document.body.style.userSelect = originalUserSelect;
        document.body.style.cursor = originalCursor;
        if (dragAnimationFrameRef.current) {
          cancelAnimationFrame(dragAnimationFrameRef.current);
          dragAnimationFrameRef.current = null;
        }
        if (dragGhostRef.current) {
          dragGhostRef.current.remove();
          dragGhostRef.current = null;
        }

        const draggedId = draggingNoteIdRef.current;
        draggingNoteIdRef.current = null;

        if (!dragMovedRef.current || draggedId === null) {
          dragMovedRef.current = false;
          return;
        }

        const anchorElement = getAnchorElementFromPoint(upEvent.clientX, upEvent.clientY);
        if (!anchorElement) {
          dragMovedRef.current = false;
          return;
        }

        const newAnchor = buildAnchorPayload(anchorElement);
        setNotes((prev) => {
          const next = prev.map((n) => (n.id === draggedId ? { ...n, anchor: newAnchor } : n));
          hasInitializedNotesRef.current = true;
          if (!readOnly) persistNotes(next);
          return next;
        });
        dragMovedRef.current = false;
        ignoreMarkerClickRef.current = true;
        setTimeout(() => {
          ignoreMarkerClickRef.current = false;
        }, 0);
      };

      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
    },
    [buildAnchorPayload, getAnchorElementFromPoint, hideTooltip, persistNotes, readOnly]
  );

  // ---- Memos ----

  const notesByAnchor = useMemo(() => {
    const grouped = new Map<number, { note: Note; index: number }[]>();

    notes.forEach((note, index) => {
      const anchorIndex = note.anchor?.elementIndex;
      if (typeof anchorIndex !== 'number') return;

      const bucket = grouped.get(anchorIndex) ?? [];
      bucket.push({ note, index });
      grouped.set(anchorIndex, bucket);
    });

    return grouped;
  }, [notes]);

  const handleSummarySaved = useCallback(
    (summary: string, keyPoints: string[]) => {
      queryClient.setQueryData<Article>(['article', id], (prev) =>
        prev ? { ...prev, aiSummary: summary, keyPoints } : prev
      );
    },
    [id, queryClient]
  );

  // ---- Render ----

  return (
    <div className="relative flex h-full w-full overflow-hidden rounded-2xl">
      {/* LEFT PANEL: Article Content */}
      <div
        className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/70 shadow-2xl backdrop-blur"
        style={compact ? { flex: 1 } : { width: `${leftPanelWidth}%` }}
      >
        {/* Header */}
        <div className="z-10 flex flex-wrap items-center gap-4 border-b border-gray-800 bg-gray-900/80 p-4 shadow-md backdrop-blur-md">
          <div className="min-w-[220px] flex-1">
            {!readOnly && isTitleEditing ? (
              <input
                type="text"
                value={titleDraft}
                onChange={(e) => {
                  resetTitleMutation();
                  setTitleDraft(e.target.value);
                }}
                onBlur={handleTitleBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    setTitleDraft(article?.title || article?.url || '');
                    setIsTitleEditing(false);
                  }
                }}
                placeholder={article?.title || article?.url || 'Untitled article'}
                maxLength={120}
                autoFocus
                className="w-full border-b border-blue-500 bg-transparent pb-1 text-2xl font-semibold text-white transition-colors focus:outline-none"
              />
            ) : readOnly ? (
              <h1 className="text-2xl leading-snug font-semibold text-white">
                {titleDraft.trim() || article?.title || article?.url || 'Untitled article'}
              </h1>
            ) : (
              <button
                type="button"
                onClick={() => setIsTitleEditing(true)}
                className="group w-full text-left"
                title="Click to edit title"
              >
                <h1 className="text-2xl leading-snug font-semibold text-white transition-colors group-hover:text-blue-300">
                  {titleDraft.trim() || article?.title || article?.url || 'Untitled article'}
                </h1>
                <p className="text-xs text-gray-500 opacity-0 transition-opacity group-hover:opacity-100">
                  Click to edit title
                </p>
              </button>
            )}
            {!readOnly && (isTitleError || isTitleSaving) && (
              <div className="mt-1 h-4 text-xs text-gray-500">
                {isTitleError ? (
                  <span className="text-red-400">{titleErrorMessage}</span>
                ) : isTitleSaving ? (
                  <span className="text-yellow-400">Saving title...</span>
                ) : null}
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-4">
            {!readOnly && <AppearanceToolbar settings={settings} onUpdate={updateSettings} />}
            {!readOnly && (
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${isNotesSaving ? 'bg-yellow-900/30 text-yellow-500' : 'bg-green-900/30 text-green-500'}`}
              >
                {isNotesSaving ? 'Saving...' : 'Saved'}
              </span>
            )}
            {headerActions}
          </div>
        </div>

        {/* Article Content */}
        <div
          ref={snapshotContainerRef}
          className={`relative flex-grow overflow-y-auto scroll-smooth ${getThemeClasses(settings.theme)}`}
          onMouseUp={!readOnly ? handleSelectionMouseUp : undefined}
          onContextMenu={!readOnly ? handleSelectionContextMenu : undefined}
        >
          <div className="relative min-h-full">
            {/* AI Summary Section */}
            <div className="mx-auto max-w-3xl px-8 pt-8">
              <ArticleSummary
                articleId={article.id}
                articleContent={article.content}
                articleTitle={article.title}
                initialSummary={article.aiSummary}
                initialKeyPoints={article.keyPoints}
                endpointUrl={aiConfig.endpointUrl}
                model={aiConfig.model}
                apiKey={aiConfig.apiKey}
                theme={settings.theme}
                onSummarySaved={handleSummarySaved}
              />
            </div>

            <ReaderView
              content={article.content}
              title={article.title}
              byline={article.byline}
              readingTimeMinutes={article.readingTimeMinutes}
              settings={settings}
              contentRef={contentRef}
            />

            {Array.from(notesByAnchor.entries()).map(([anchorIndex, groupedNotes]) => {
              const anchorElement = annotatableElements[anchorIndex];
              if (!anchorElement) return null;

              return (
                <NoteMarkerGroupMemo
                  key={`anchor-${anchorIndex}`}
                  anchorElement={anchorElement}
                  notes={groupedNotes}
                  onScrollTo={scrollToNote}
                  registerMarker={registerMarker}
                  onStartDrag={startMarkerDrag}
                  ignoreClicksRef={ignoreMarkerClickRef}
                  onShowTooltip={showTooltip}
                  onHideTooltip={hideTooltip}
                  onMoveTooltip={moveTooltip}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* RESIZER - hidden in compact mode */}
      {!compact && (
        <div
          className="group relative z-30 mx-1 flex w-1 cursor-col-resize items-center justify-center rounded-full bg-gray-800 transition-colors hover:bg-blue-500"
          onMouseDown={startResizing}
        >
          <div className="absolute inset-y-0 -right-2 -left-2 z-30" />
          <div className="h-8 w-1 rounded-full bg-gray-600 group-hover:bg-white" />
        </div>
      )}

      {/* Sidebar toggle button for compact mode */}
      {compact && (
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="absolute top-2 right-2 z-40 rounded-lg border border-gray-700 bg-gray-800/80 px-2 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-700"
        >
          {showSidebar ? 'Hide' : 'Notes'}
        </button>
      )}

      {/* RIGHT PANEL: Sidebar */}
      {(showSidebar || !compact) && (
        <div
          className="z-20 flex h-full flex-col rounded-2xl border border-gray-800 bg-gray-900/70 shadow-2xl backdrop-blur"
          style={
            compact
              ? { position: 'absolute', right: 0, top: 0, width: '300px', zIndex: 30 }
              : { width: `${100 - leftPanelWidth}%` }
          }
        >
          <div className="border-b border-gray-800 bg-gray-900/80 p-4">
            <h2 className="text-lg font-semibold text-gray-100">Sidebar</h2>
            <p className="text-sm text-gray-500">
              {activeSidebarTab === 'notes'
                ? `${notes.length} notes added`
                : activeSidebarTab === 'ai'
                  ? 'Ask AI using your article and notes context'
                  : 'Organize with tags'}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setActiveSidebarTab('notes')}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                  activeSidebarTab === 'notes'
                    ? 'border-blue-500/50 bg-blue-500/20 text-blue-200'
                    : 'border-gray-700 bg-gray-800/70 text-gray-300 hover:bg-gray-700'
                }`}
              >
                Notes
              </button>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setActiveSidebarTab('ai')}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    activeSidebarTab === 'ai'
                      ? 'border-blue-500/50 bg-blue-500/20 text-blue-200'
                      : 'border-gray-700 bg-gray-800/70 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  AI Chat
                </button>
              )}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => setActiveSidebarTab('tags')}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                    activeSidebarTab === 'tags'
                      ? 'border-blue-500/50 bg-blue-500/20 text-blue-200'
                      : 'border-gray-700 bg-gray-800/70 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  Tags
                </button>
              )}
            </div>
          </div>

          {activeSidebarTab === 'notes' ? (
            <div className="flex-grow space-y-4 overflow-y-auto p-4">
              {notes.length === 0 && (
                <div className="mt-10 text-center text-gray-500">
                  <p>No notes yet.</p>
                  {!readOnly && (
                    <p className="text-sm">Select text, then use Add note from the actions menu.</p>
                  )}
                </div>
              )}

              {notes.map((note, index) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  index={index}
                  onScrollTo={scrollToNote}
                  onDelete={handleDeleteNote}
                  onChange={handleNoteChange}
                  readOnly={readOnly}
                />
              ))}
            </div>
          ) : activeSidebarTab === 'ai' && !readOnly ? (
            <NotesAIChat
              article={article}
              notes={notes}
              queuedPrompt={queuedAIPrompt}
              onQueuedPromptHandled={() => setQueuedAIPrompt(null)}
            />
          ) : activeSidebarTab === 'tags' && !readOnly ? (
            <div className="flex-grow overflow-y-auto p-4">
              <ArticleTagEditor article={article} />
            </div>
          ) : (
            <div className="flex-grow overflow-y-auto p-4">
              <p className="mt-10 text-center text-sm text-gray-500">
                Not available in read-only mode.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Selection menu portal */}
      {!readOnly && typeof document !== 'undefined' && selectionMenu
        ? createPortal(
            <div
              data-selection-actions-menu="true"
              className="fixed z-[120] min-w-[180px] rounded-xl border border-gray-700 bg-gray-950/95 p-1 shadow-2xl backdrop-blur"
              style={{
                left: Math.min(selectionMenu.x, window.innerWidth - 200),
                top: Math.min(selectionMenu.y, window.innerHeight - 120),
              }}
            >
              <button
                type="button"
                onClick={addNoteFromSelection}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-100 transition-colors hover:bg-gray-800"
              >
                Add note
              </button>
              <button
                type="button"
                onClick={askAIFromSelection}
                className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-100 transition-colors hover:bg-gray-800"
              >
                Ask AI
              </button>
              {onSpawnNote && (
                <button
                  type="button"
                  onClick={spawnNoteFromSelection}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-100 transition-colors hover:bg-gray-800"
                >
                  Add to Board
                </button>
              )}
              {onSpawnAIChat && (
                <button
                  type="button"
                  onClick={spawnAIChatFromSelection}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-gray-100 transition-colors hover:bg-gray-800"
                >
                  Ask AI on Board
                </button>
              )}
            </div>,
            document.body
          )
        : null}

      {/* Tooltip portal */}
      {typeof document !== 'undefined' && activeTooltip
        ? createPortal(
            <div
              className="annotation-tooltip-floating"
              style={{ left: activeTooltip.x, top: activeTooltip.y }}
            >
              {activeTooltip.text}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
