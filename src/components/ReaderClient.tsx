'use client';

import { useState, useRef, useEffect, useCallback, memo, startTransition, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Article, Note, ReaderSettings } from '../types';
import { ReaderView, getThemeClasses } from './ReaderView';
import { AppearanceToolbar } from './AppearanceToolbar';
import { Navbar } from './Navbar';
import { NotesAIChat } from './NotesAIChat';
import { ArticleTagEditor } from './ArticleTagEditor';

const ANNOTATABLE_SELECTOR = [
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'blockquote',
  'pre',
  'figure',
  'figcaption',
  'img',
  'video',
  'iframe',
  'code',
  'table',
  'thead',
  'tbody',
  'tr',
  'td',
  'th',
].join(', ');

const SCROLL_OFFSET = 80;
const MAX_SELECTION_MENU_TEXT = 600;

type SelectionActionMenuState = {
  x: number;
  y: number;
  text: string;
  anchor?: Note['anchor'];
};

export default function ReaderClient({ articleId }: { articleId: string }) {
  const id = articleId;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [notes, setNotes] = useState<Note[]>([]);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'notes' | 'ai' | 'tags'>('notes');
  const [titleDraft, setTitleDraft] = useState('');
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [selectionMenu, setSelectionMenu] = useState<SelectionActionMenuState | null>(null);
  const [queuedAIPrompt, setQueuedAIPrompt] = useState<string | null>(null);

  // Layout State
  const [leftPanelWidth, setLeftPanelWidth] = useState(66.66);
  const isDraggingRef = useRef(false);

  // Settings State
  const [settings, setSettings] = useState<ReaderSettings>({
    fontSize: 'medium',
    theme: 'dark',
    fontFamily: 'sans',
  });

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

  const {
    data: article,
    isLoading: isArticleLoading,
    error: articleError,
  } = useQuery<Article>({
    queryKey: ['article', id],
    queryFn: async () => {
      const response = await fetch(`/api/articles/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('NOT_FOUND');
        }
        throw new Error('Failed to fetch article');
      }
      return response.json();
    },
    enabled: Boolean(id),
  });

  const { mutate: persistNotes, isPending: isNotesSaving } = useMutation({
    mutationFn: async (updatedNotes: Note[]) => {
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
      queryClient.setQueryData<Article>(['article', id], (prev) =>
        prev ? { ...prev, title: newTitle } : prev
      );
      queryClient.invalidateQueries({ queryKey: ['articles'] });
    },
  });

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

  useEffect(() => {
    if (!article || !id) return;
    const trimmedDraft = titleDraft.trim();
    const currentTitle = (article.title || '').trim();
    if (!trimmedDraft || trimmedDraft === currentTitle) return;

    const timeoutId = setTimeout(() => {
      persistTitle(trimmedDraft);
    }, 600);

    return () => clearTimeout(timeoutId);
  }, [titleDraft, article, id, persistTitle]);

  useEffect(() => {
    if (!id || isArticleLoading) return;
    if (!hasInitializedNotesRef.current) {
      hasInitializedNotesRef.current = true;
      return;
    }

    const timeoutId = setTimeout(() => {
      persistNotes(notes);
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [notes, id, isArticleLoading, persistNotes]);

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
  }, []);

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
    [buildAnchorPayload, getAnchorElementFromPoint]
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

  const handleNoteChange = useCallback((id: number, text: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, text } : n)));
  }, []);

  const handleDeleteNote = useCallback((id: number) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
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
          persistNotes(next);
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
    [buildAnchorPayload, getAnchorElementFromPoint, hideTooltip, persistNotes]
  );

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

  if (isArticleLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading article...</p>
        </div>
      </div>
    );
  }

  if (articleError && !article) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-900 text-gray-200 gap-4">
        <p>
          {articleError.message === 'NOT_FOUND' ? 'Document not found.' : 'Failed to load article.'}
        </p>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition"
        >
          Back to Library
        </button>
      </div>
    );
  }

  if (!article) return null;

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-black via-gray-950 to-gray-900 font-sans text-gray-100 overflow-hidden">
      <Navbar />
      <div className="flex flex-1 overflow-hidden p-4 md:p-6">
        {/* LEFT PANEL: Website Content */}
        <div
          className="h-full flex flex-col bg-gray-900/70 backdrop-blur border border-gray-800 rounded-2xl overflow-hidden shadow-2xl relative"
          style={{ width: `${leftPanelWidth}%` }}
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-800 bg-gray-900/80 backdrop-blur-md z-10 shadow-md flex flex-wrap items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="p-2 rounded-lg bg-gray-800/60 hover:bg-gray-800 text-gray-200 transition-colors border border-gray-700"
              title="Back to Library"
            >
              ←
            </button>

            <div className="flex-1 min-w-[220px]">
              {isTitleEditing ? (
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
                  className="w-full bg-transparent text-2xl font-semibold text-white border-b border-blue-500 focus:outline-none pb-1 transition-colors"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setIsTitleEditing(true)}
                  className="w-full text-left group"
                  title="Click to edit title"
                >
                  <h1 className="text-2xl font-semibold text-white group-hover:text-blue-300 transition-colors leading-snug">
                    {titleDraft.trim() || article?.title || article?.url || 'Untitled article'}
                  </h1>
                  <p className="text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    Click to edit title
                  </p>
                </button>
              )}
              {(isTitleError || isTitleSaving) && (
                <div className="text-xs text-gray-500 h-4 mt-1">
                  {isTitleError ? (
                    <span className="text-red-400">{titleErrorMessage}</span>
                  ) : isTitleSaving ? (
                    <span className="text-yellow-400">Saving title...</span>
                  ) : null}
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 ml-auto">
              <AppearanceToolbar settings={settings} onUpdate={updateSettings} />
              <span
                className={`text-xs font-medium px-2 py-1 rounded-full ${isNotesSaving ? 'bg-yellow-900/30 text-yellow-500' : 'bg-green-900/30 text-green-500'}`}
              >
                {isNotesSaving ? 'Saving...' : 'Saved'}
              </span>
            </div>
          </div>

          {/* Article Content */}
          <div
            ref={snapshotContainerRef}
            className={`flex-grow overflow-y-auto relative scroll-smooth ${getThemeClasses(settings.theme)}`}
            onMouseUp={handleSelectionMouseUp}
            onContextMenu={handleSelectionContextMenu}
          >
            <div className="relative min-h-full">
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

        {/* RESIZER */}
        <div
          className="w-1 bg-gray-800 hover:bg-blue-500 cursor-col-resize transition-colors z-30 flex items-center justify-center relative group mx-1 rounded-full"
          onMouseDown={startResizing}
        >
          <div className="absolute inset-y-0 -left-2 -right-2 z-30" />
          <div className="w-1 h-8 bg-gray-600 rounded-full group-hover:bg-white" />
        </div>

        {/* RIGHT PANEL: Notes & Tags */}
        <div
          className="h-full bg-gray-900/70 backdrop-blur flex flex-col shadow-2xl z-20 border border-gray-800 rounded-2xl"
          style={{ width: `${100 - leftPanelWidth}%` }}
        >
          <div className="p-4 border-b border-gray-800 bg-gray-900/80">
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
            </div>
          </div>

          {activeSidebarTab === 'notes' ? (
            <div className="flex-grow overflow-y-auto p-4 space-y-4">
              {notes.length === 0 && (
                <div className="text-center text-gray-500 mt-10">
                  <p>No notes yet.</p>
                  <p className="text-sm">Select text, then use Add note from the actions menu.</p>
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
                />
              ))}
            </div>
          ) : activeSidebarTab === 'ai' ? (
            <NotesAIChat
              article={article}
              notes={notes}
              queuedPrompt={queuedAIPrompt}
              onQueuedPromptHandled={() => setQueuedAIPrompt(null)}
            />
          ) : (
            <div className="flex-grow overflow-y-auto p-4">
              <ArticleTagEditor article={article} />
            </div>
          )}
        </div>
        {typeof document !== 'undefined' && selectionMenu
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
              </div>,
              document.body
            )
          : null}
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
    </div>
  );
}

function NoteMarkerGroup({
  anchorElement,
  notes,
  onScrollTo,
  registerMarker,
  onStartDrag,
  ignoreClicksRef,
  onShowTooltip,
  onHideTooltip,
  onMoveTooltip,
}: {
  anchorElement: HTMLElement;
  notes: { note: Note; index: number }[];
  onScrollTo: (note: Note) => void;
  registerMarker: (noteId: number, el: HTMLElement | null) => void;
  onStartDrag: (note: Note, displayIndex: number) => (event: React.MouseEvent) => void;
  ignoreClicksRef: React.MutableRefObject<boolean>;
  onShowTooltip: (text: string, e: React.MouseEvent) => void;
  onHideTooltip: () => void;
  onMoveTooltip: (e: MouseEvent) => void;
}) {
  const tagName = anchorElement.tagName.toLowerCase();
  const isMedia = ['img', 'video', 'iframe'].includes(tagName);
  const portalTarget = useMemo(() => {
    if (typeof document === 'undefined') return null;
    const mount = document.createElement('span');
    mount.className = 'annotation-mount';
    return mount;
  }, []);

  useEffect(() => {
    if (!portalTarget) return;

    const host = anchorElement.parentElement ?? anchorElement;
    host.classList.add('annotation-host');

    if (isMedia) {
      const referenceNode = anchorElement;
      const parentNode = referenceNode.parentElement ?? host;
      parentNode.insertBefore(portalTarget, referenceNode);
    } else {
      anchorElement.classList.add('annotation-host');
      anchorElement.appendChild(portalTarget);
    }

    return () => {
      if (portalTarget.parentNode) {
        portalTarget.parentNode.removeChild(portalTarget);
      }
    };
  }, [anchorElement, isMedia, portalTarget]);

  if (!portalTarget) return null;

  return createPortal(
    <div className={`annotation-marker-group ${isMedia ? 'annotation-marker-group-media' : ''}`}>
      {notes.map(({ note, index }) => (
        <button
          key={note.id}
          className="annotation-marker"
          ref={(el) => registerMarker(note.id, el)}
          onMouseDown={onStartDrag(note, index)}
          onMouseEnter={(e) =>
            onShowTooltip(note.text?.trim() || note.anchor?.textPreview || `Note ${index + 1}`, e)
          }
          onMouseMove={(e) => onMoveTooltip(e.nativeEvent)}
          onMouseLeave={onHideTooltip}
          onClick={(e) => {
            e.stopPropagation();
            if (ignoreClicksRef.current) return;
            onScrollTo(note);
          }}
          title={`Note ${index + 1}`}
        >
          {index + 1}
        </button>
      ))}
    </div>,
    portalTarget
  );
}

const NoteMarkerGroupMemo = memo(NoteMarkerGroup, (prev, next) => {
  if (prev.anchorElement !== next.anchorElement) return false;
  if (prev.notes.length !== next.notes.length) return false;
  for (let i = 0; i < prev.notes.length; i++) {
    const a = prev.notes[i].note;
    const b = next.notes[i].note;
    if (a.id !== b.id) return false;
    if (a.text !== b.text) return false;
    if (a.anchor?.elementIndex !== b.anchor?.elementIndex) return false;
    if (a.anchor?.textPreview !== b.anchor?.textPreview) return false;
  }
  return true;
});

interface NoteCardProps {
  note: Note;
  index: number;
  onScrollTo: (note: Note) => void;
  onDelete: (id: number) => void;
  onChange: (id: number, text: string) => void;
}

const NoteCard = memo(({ note, index, onScrollTo, onDelete, onChange }: NoteCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const anchorLabel =
    note.anchor && typeof note.anchor.elementIndex === 'number'
      ? `${note.anchor.tagName?.toLowerCase() || 'element'} #${note.anchor.elementIndex + 1}`
      : 'Location unavailable';

  return (
    <div
      className="bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-700 hover:border-gray-600 transition-colors group"
      onClick={() => onScrollTo(note)}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-mono text-gray-400 bg-gray-900/50 px-2 py-1 rounded flex items-center gap-2">
          <span className="w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center text-[10px] text-yellow-900 font-bold">
            {index + 1}
          </span>
          {anchorLabel}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(note.id);
          }}
          className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          Delete
        </button>
      </div>
      {note.anchor?.textPreview && (
        <p className="text-xs text-gray-500 mb-3 italic overflow-hidden text-ellipsis whitespace-nowrap">
          &ldquo;{note.anchor.textPreview}&rdquo;
        </p>
      )}
      {isEditing ? (
        <textarea
          value={note.text}
          onChange={(e) => onChange(note.id, e.target.value)}
          placeholder="Write your observation..."
          rows={3}
          autoFocus
          className="w-full p-3 text-gray-200 bg-gray-900/60 resize-none focus:outline-none rounded-md transition-colors placeholder-gray-600 min-h-[120px]"
          onClick={(e) => e.stopPropagation()}
          onBlur={() => setIsEditing(false)}
        />
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          className="w-full text-left bg-gray-900/30 hover:bg-gray-900/60 transition-colors rounded-md p-3"
        >
          <p
            className={`text-sm whitespace-pre-line overflow-hidden max-h-[4.5rem] ${note.text ? 'text-gray-200' : 'text-gray-500 italic'}`}
          >
            {note.text || 'Click to write your observation...'}
          </p>
        </button>
      )}
    </div>
  );
});
NoteCard.displayName = 'NoteCard';
