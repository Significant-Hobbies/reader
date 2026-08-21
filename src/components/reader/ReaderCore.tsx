'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Highlighter,
  MessageSquare,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { AIConfig } from '../../lib/ai-config';
import { AI_CONFIG_STORAGE_KEY, DEFAULT_AI_CONFIG } from '../../lib/ai-config';
import { trackCoreAction } from '../../lib/analytics';
import { ANNOTATABLE_SELECTOR } from '../../lib/annotatable';
import { buildResearchBrief, type SourceRelationshipMap } from '../../lib/research-brief';
import type { Article, ElementAnchor, Note, ReaderSettings, SessionReview } from '../../types';
import { AppearanceToolbar } from '../AppearanceToolbar';
import { ArticleSummary } from '../ArticleSummary';
import { ArticleTagEditor } from '../ArticleTagEditor';
import { NotesAIChat } from '../NotesAIChat';
import { getThemeClasses, ReaderView } from '../ReaderView';
import { ResearchBriefPanel } from '../ResearchBriefPanel';
import { NoteCard } from './NoteCard';
import { NoteMarkerGroupMemo } from './NoteMarkerGroup';
import { SessionReviewPanel } from './SessionReviewPanel';

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

interface ReaderCoreHandlers {
  onArticleChange?: (patch: Partial<Article>) => Promise<void> | void;
  onSpawnNote?: (anchor: ElementAnchor, text: string) => void;
  onSpawnAIChat?: (anchor: ElementAnchor, text: string) => void;
}

export interface ReaderCoreProps {
  article: Article;
  readOnly?: boolean;
  localMode?: boolean;
  compact?: boolean;
  headerActions?: React.ReactNode;
  handlers?: ReaderCoreHandlers;
}

function computeMenuPosition(
  clientX: number,
  clientY: number,
  range: Range
): { x: number; y: number } {
  if (Number.isFinite(clientX) && Number.isFinite(clientY) && (clientX > 0 || clientY > 0)) {
    return { x: clientX, y: clientY };
  }
  const rect = range.getBoundingClientRect();
  return { x: rect.right, y: rect.bottom };
}

// ---------------------------------------------------------------------------
// ReaderCore
// ---------------------------------------------------------------------------

export function ReaderCore({
  article,
  readOnly = false,
  localMode = false,
  compact = false,
  headerActions,
  handlers = {},
}: ReaderCoreProps) {
  const { onArticleChange, onSpawnNote, onSpawnAIChat } = handlers;
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
  const [recentlySaved, setRecentlySaved] = useState(false);
  const [hasUnsavedNoteChanges, setHasUnsavedNoteChanges] = useState(false);

  // Session review state
  const [sessionReview, setSessionReview] = useState<SessionReview | null>(
    article.sessionReview ?? null
  );
  const [isGeneratingReview, setIsGeneratingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Layout
  const [leftPanelWidth, setLeftPanelWidth] = useState(66.66);
  const isDraggingRef = useRef(false);

  // Sidebar visibility for compact mode
  const [showSidebar, setShowSidebar] = useState(!compact);

  // Scroll-to-top affordance for long articles.
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null);

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

  const {
    mutate: persistNotes,
    isPending: isNotesSaving,
    isError: isNotesError,
    error: notesMutationError,
    reset: resetNotesMutation,
  } = useMutation({
    mutationFn: async (updatedNotes: Note[]) => {
      if (readOnly) return updatedNotes;
      if (onArticleChange) {
        await onArticleChange({ notes: updatedNotes, notesCount: updatedNotes.length });
        return updatedNotes;
      }
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
      setHasUnsavedNoteChanges(false);
      queryClient.setQueryData<Article>(['article', id], (prev) =>
        prev ? { ...prev, notes: updatedNotes, notesCount: updatedNotes.length } : prev
      );
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      setRecentlySaved(true);
    },
  });

  // Clear the "Saved" indicator a moment after a successful save
  useEffect(() => {
    if (!recentlySaved) return;
    const timer = setTimeout(() => setRecentlySaved(false), 1800);
    return () => clearTimeout(timer);
  }, [recentlySaved]);

  const {
    mutate: persistTitle,
    isPending: isTitleSaving,
    isError: isTitleError,
    error: titleMutationError,
    reset: resetTitleMutation,
  } = useMutation({
    mutationFn: async (newTitle: string) => {
      if (readOnly) return newTitle;
      if (onArticleChange) {
        await onArticleChange({ title: newTitle });
        return newTitle;
      }
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
      setHasUnsavedNoteChanges(false);
      setRecentlySaved(false);
      setActiveNoteId(null);
      resetNotesMutation();
    });

    const maxExistingId = (article.notes ?? []).reduce(
      (max, note) => (typeof note.id === 'number' ? Math.max(max, note.id) : max),
      0
    );
    nextNoteIdRef.current = maxExistingId;
    hasInitializedNotesRef.current = false;
  }, [article, resetNotesMutation]);

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

  // Track article scroll for scroll-to-top affordance and reading progress.
  useEffect(() => {
    const container = snapshotContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const maxScroll = container.scrollHeight - container.clientHeight;
      setIsScrolled(container.scrollTop > 320);
      setScrollProgress(maxScroll > 0 ? Math.min(container.scrollTop / maxScroll, 1) : 0);
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => container.removeEventListener('scroll', handleScroll);
  }, [article?.id]);

  const scrollToTop = useCallback(() => {
    snapshotContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

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

  const markNotesChanged = useCallback(() => {
    resetNotesMutation();
    setRecentlySaved(false);
    setHasUnsavedNoteChanges(true);
  }, [resetNotesMutation]);

  const createNote = useCallback(
    (text = '', anchor?: Note['anchor']) => {
      nextNoteIdRef.current += 1;
      const noteId = nextNoteIdRef.current;
      const newNote: Note = {
        id: noteId,
        text,
        anchor,
      };
      markNotesChanged();
      setNotes((prev) => [...prev, newNote]);
      setActiveSidebarTab('notes');
      setShowSidebar(true);
      // Analytics — core action: a note / highlight was added while reading.
      trackCoreAction('note_added');
    },
    [markNotesChanged]
  );

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

      const pos = computeMenuPosition(clientX, clientY, range);
      const anchorElement =
        getAnchorElementFromPoint(pos.x, pos.y) ||
        (commonNode.closest?.('[data-note-anchor-index]') as HTMLElement | null);

      const anchorPayload = anchorElement
        ? {
            ...buildAnchorPayload(anchorElement),
            textPreview: selectedText.slice(0, 200),
          }
        : undefined;

      setSelectionMenu({
        x: pos.x,
        y: pos.y,
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
    if (localMode) return;
    if (!selectionMenu) return;
    const prompt = `Explain this selected excerpt in context:\n\n"${selectionMenu.text}"`;
    setActiveSidebarTab('ai');
    setShowSidebar(true);
    setQueuedAIPrompt(prompt);
    setSelectionMenu(null);
  }, [localMode, selectionMenu]);

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

  const handleNoteChange = useCallback(
    (noteId: number, text: string) => {
      markNotesChanged();
      setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, text } : n)));
    },
    [markNotesChanged]
  );

  const handleDeleteNote = useCallback(
    (noteId: number) => {
      markNotesChanged();
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    },
    [markNotesChanged]
  );

  const scrollToNote = useCallback(
    (note: Note) => {
      const container = snapshotContainerRef.current;
      if (!container) return;

      setActiveNoteId(note.id);
      if (compact) {
        setShowSidebar(false);
      }

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
    [refreshAnnotationTargets, compact]
  );

  const navigateNote = useCallback(
    (direction: 'prev' | 'next') => {
      if (notes.length === 0) return;
      const currentIndex =
        activeNoteId !== null ? notes.findIndex((note) => note.id === activeNoteId) : -1;
      const startIndex =
        currentIndex >= 0 ? currentIndex : direction === 'next' ? -1 : notes.length;
      const nextIndex =
        direction === 'next'
          ? Math.min(startIndex + 1, notes.length - 1)
          : Math.max(startIndex - 1, 0);
      const target = notes[nextIndex];
      if (target) {
        scrollToNote(target);
      }
    },
    [activeNoteId, notes, scrollToNote]
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
  const notesErrorMessage =
    notesMutationError instanceof Error ? notesMutationError.message : 'Failed to save notes';

  const retryNoteSave = useCallback(() => {
    resetNotesMutation();
    persistNotes(notes);
  }, [notes, persistNotes, resetNotesMutation]);

  const generateReview = useCallback(async () => {
    setIsGeneratingReview(true);
    setReviewError(null);
    try {
      const aiCfg = loadAIConfig();
      const res = await fetch(`/api/articles/${id}/session-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointUrl: aiCfg.endpointUrl,
          model: aiCfg.model,
          apiKey: aiCfg.apiKey,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Request failed (${res.status})`);
      }
      const data = (await res.json()) as { review: SessionReview };
      setSessionReview(data.review);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Failed to generate review');
    } finally {
      setIsGeneratingReview(false);
    }
  }, [id]);

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
          if (!readOnly) {
            markNotesChanged();
            persistNotes(next);
          }
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
    [
      buildAnchorPayload,
      getAnchorElementFromPoint,
      hideTooltip,
      markNotesChanged,
      persistNotes,
      readOnly,
    ]
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

  const researchBrief = useMemo(() => buildResearchBrief({ ...article, notes }), [article, notes]);
  const sourceMapQuery = useQuery({
    queryKey: ['source-map', article.id],
    queryFn: async () => {
      const response = await fetch(
        `/api/research/source-map?focusId=${encodeURIComponent(article.id)}`
      );
      if (!response.ok) throw new Error('Failed to load source map');
      return (await response.json()) as SourceRelationshipMap;
    },
    enabled: !readOnly && !localMode,
    staleTime: 60_000,
  });

  const handleSummarySaved = useCallback(
    (summary: string, keyPoints: string[]) => {
      onArticleChange?.({ aiSummary: summary, keyPoints });
      queryClient.setQueryData<Article>(['article', id], (prev) =>
        prev ? { ...prev, aiSummary: summary, keyPoints } : prev
      );
    },
    [id, onArticleChange, queryClient]
  );

  // ---- Render ----

  return (
    <div className="relative flex h-full w-full overflow-hidden rounded-lg">
      {/* LEFT PANEL: Article Content */}
      <div
        className="relative flex h-full flex-col overflow-hidden rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)]/85 shadow-[0_18px_55px_rgba(0,0,0,0.22)] backdrop-blur"
        style={compact ? { flex: 1 } : { width: `${leftPanelWidth}%` }}
      >
        {/* Header */}
        <div className="z-10 flex flex-wrap items-center gap-4 border-b border-[var(--gray-5)] bg-[var(--gray-2)]/90 p-4 shadow-md backdrop-blur-md">
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
                className="w-full border-b border-[var(--accent-8)] bg-transparent pb-1 text-2xl font-semibold text-[var(--gray-12)] transition-colors focus:outline-none"
              />
            ) : readOnly ? (
              <h1 className="text-2xl leading-snug font-semibold text-[var(--gray-12)]">
                {titleDraft.trim() || article?.title || article?.url || 'Untitled article'}
              </h1>
            ) : (
              <button
                type="button"
                onClick={() => setIsTitleEditing(true)}
                className="group w-full text-left"
                title="Click to edit title"
              >
                <h1 className="truncate text-2xl leading-snug font-semibold text-[var(--gray-12)] decoration-[var(--accent-8)] decoration-2 underline-offset-4 transition-colors group-hover:underline">
                  {titleDraft.trim() || article?.title || article?.url || 'Untitled article'}
                </h1>
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

          <div className="ml-auto flex items-center gap-3">
            {!readOnly && <AppearanceToolbar settings={settings} onUpdate={updateSettings} />}
            {!readOnly &&
              (isNotesError || isNotesSaving || recentlySaved || hasUnsavedNoteChanges) && (
                <div
                  aria-live="polite"
                  className={`text-xs font-medium transition-opacity ${
                    isNotesError
                      ? 'text-red-400'
                      : isNotesSaving || hasUnsavedNoteChanges
                        ? 'text-yellow-400'
                        : 'text-[var(--gray-10)]'
                  }`}
                >
                  {isNotesError ? (
                    <button
                      type="button"
                      onClick={retryNoteSave}
                      className="rounded-sm underline-offset-2 hover:underline"
                      title={notesErrorMessage}
                    >
                      Notes not saved. Retry
                    </button>
                  ) : isNotesSaving ? (
                    'Saving notes...'
                  ) : hasUnsavedNoteChanges ? (
                    'Pending save'
                  ) : (
                    'Notes saved'
                  )}
                </div>
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
          <div
            aria-hidden
            className="pointer-events-none sticky top-0 z-20 h-0.5 bg-[var(--gray-4)]"
          >
            <div
              className="h-full bg-[var(--accent-9)] transition-[width] duration-150"
              style={{ width: `${scrollProgress * 100}%` }}
            />
          </div>
          <div className="relative min-h-full">
            {/* AI Summary Section */}
            <div className="mx-auto max-w-3xl px-8 pt-8">
              {!localMode && (
                <>
                  <ArticleSummary
                    article={{
                      id: article.id,
                      content: article.content,
                      title: article.title,
                    }}
                    initial={{
                      summary: article.aiSummary,
                      keyPoints: article.keyPoints,
                    }}
                    aiConfig={{
                      endpointUrl: aiConfig.endpointUrl,
                      model: aiConfig.model,
                      apiKey: aiConfig.apiKey,
                    }}
                    theme={settings.theme}
                    onSummarySaved={handleSummarySaved}
                  />
                  <ResearchBriefPanel
                    brief={researchBrief}
                    sourceMap={sourceMapQuery.data}
                    isSourceMapLoading={sourceMapQuery.isLoading}
                    theme={settings.theme}
                  />
                </>
              )}
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
                  ignoreClicksRef={ignoreMarkerClickRef}
                  tooltip={{ onShow: showTooltip, onHide: hideTooltip, onMove: moveTooltip }}
                  callbacks={{
                    onScrollTo: scrollToNote,
                    registerMarker,
                    onStartDrag: startMarkerDrag,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Scroll-to-top affordance — visible after some scroll on either mode. */}
      {isScrolled && (
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Scroll to top of article"
          className="absolute bottom-4 left-4 z-30 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--gray-6)] bg-[var(--gray-2)]/95 text-[var(--gray-12)] shadow-lg backdrop-blur transition-colors hover:bg-[var(--gray-3)] focus-visible:ring-2 focus-visible:ring-[var(--accent-8)] focus-visible:outline-none"
          style={compact ? { right: 'auto', left: '1rem' } : undefined}
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      )}

      {/* RESIZER - hidden in compact mode */}
      {!compact && (
        <div
          className="group relative z-30 mx-1 flex w-1 cursor-col-resize items-center justify-center rounded-sm bg-[var(--gray-4)] transition-colors hover:bg-[var(--accent-8)]"
          onMouseDown={startResizing}
        >
          <div className="absolute inset-y-0 -right-2 -left-2 z-30" />
          <div className="h-8 w-1 rounded-sm bg-[var(--gray-7)] group-hover:bg-[var(--accent-11)]" />
        </div>
      )}

      {/* Sidebar toggle button for compact mode */}
      {compact && !showSidebar && (
        <button
          onClick={() => setShowSidebar(true)}
          aria-label={`Show notes sidebar${notes.length > 0 ? ` (${notes.length})` : ''}`}
          className="absolute top-2 right-2 z-40 inline-flex h-11 min-w-11 items-center gap-1.5 rounded-md border border-[var(--gray-6)] bg-[var(--gray-3)]/95 px-3 text-xs font-medium text-gray-200 shadow-md backdrop-blur transition-colors hover:bg-[var(--gray-4)] focus-visible:ring-2 focus-visible:ring-[var(--accent-8)] focus-visible:outline-none"
        >
          <Highlighter className="h-3.5 w-3.5" />
          Notes
          {notes.length > 0 && (
            <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent-9)] px-1.5 text-[10px] font-semibold text-[var(--accent-12)]">
              {notes.length}
            </span>
          )}
        </button>
      )}

      {/* Backdrop scrim for compact mode — closes sidebar on tap. */}
      {compact && showSidebar && (
        <button
          type="button"
          aria-label="Close notes sidebar"
          onClick={() => setShowSidebar(false)}
          className="absolute inset-0 z-20 bg-black/40 backdrop-blur-[1px] transition-opacity"
        />
      )}

      {/* RIGHT PANEL: Sidebar */}
      {(showSidebar || !compact) && (
        <div
          className="z-20 flex h-full flex-col rounded-lg border border-[var(--gray-5)] bg-[var(--gray-2)]/85 shadow-[0_18px_55px_rgba(0,0,0,0.22)] backdrop-blur"
          style={
            compact
              ? {
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  // Never wider than the viewport — avoids horizontal scroll
                  // on a 390px phone while staying usable.
                  width: 'min(320px, 92vw)',
                  zIndex: 30,
                }
              : { width: `${100 - leftPanelWidth}%` }
          }
        >
          <div className="border-b border-[var(--gray-5)] bg-[var(--gray-2)]/90 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-gray-100">
                  {activeSidebarTab === 'notes'
                    ? 'Notes'
                    : activeSidebarTab === 'ai'
                      ? 'AI Chat'
                      : 'Tags'}
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  {activeSidebarTab === 'notes'
                    ? notes.length === 0
                      ? 'Highlight text to add a note'
                      : `${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`
                    : activeSidebarTab === 'ai'
                      ? 'Grounded in this article and your notes'
                      : 'Organize this article'}
                </p>
              </div>
              {compact && (
                <button
                  type="button"
                  onClick={() => setShowSidebar(false)}
                  aria-label="Close sidebar"
                  className="-mr-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--gray-11)] transition-colors hover:bg-[var(--gray-3)] hover:text-[var(--gray-12)] focus-visible:ring-2 focus-visible:ring-[var(--accent-8)] focus-visible:outline-none"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            {!readOnly &&
              activeSidebarTab === 'notes' &&
              (isNotesError || isNotesSaving || recentlySaved || hasUnsavedNoteChanges) && (
                <div
                  aria-live="polite"
                  className={`mt-3 rounded-md border px-3 py-2 text-xs ${
                    isNotesError
                      ? 'border-red-500/30 bg-red-500/10 text-red-300'
                      : isNotesSaving || hasUnsavedNoteChanges
                        ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'
                        : 'border-[var(--gray-6)] bg-[var(--gray-3)] text-[var(--gray-10)]'
                  }`}
                >
                  {isNotesError ? (
                    <div className="flex items-center justify-between gap-3">
                      <span>{notesErrorMessage}</span>
                      <button
                        type="button"
                        onClick={retryNoteSave}
                        className="shrink-0 font-medium underline-offset-2 hover:underline"
                      >
                        Retry
                      </button>
                    </div>
                  ) : isNotesSaving ? (
                    'Saving notes...'
                  ) : hasUnsavedNoteChanges ? (
                    'Pending save'
                  ) : (
                    'Notes saved'
                  )}
                </div>
              )}
            <div
              role="tablist"
              aria-label="Sidebar sections"
              className="mt-3 inline-flex rounded-md border border-[var(--gray-6)] bg-[var(--gray-3)]/60 p-0.5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeSidebarTab === 'notes'}
                onClick={() => setActiveSidebarTab('notes')}
                className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  activeSidebarTab === 'notes'
                    ? 'bg-[var(--accent-4)] text-[var(--accent-12)] shadow-sm'
                    : 'text-[var(--gray-11)] hover:text-[var(--gray-12)]'
                }`}
              >
                <Highlighter className="h-3.5 w-3.5" />
                Notes
                {notes.length > 0 && (
                  <span
                    className={`inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                      activeSidebarTab === 'notes'
                        ? 'bg-[var(--accent-9)] text-[var(--accent-12)]'
                        : 'bg-[var(--gray-5)] text-[var(--gray-11)]'
                    }`}
                  >
                    {notes.length}
                  </span>
                )}
              </button>
              {!readOnly && !localMode && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeSidebarTab === 'ai'}
                  onClick={() => setActiveSidebarTab('ai')}
                  className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    activeSidebarTab === 'ai'
                      ? 'bg-[var(--accent-4)] text-[var(--accent-12)] shadow-sm'
                      : 'text-[var(--gray-11)] hover:text-[var(--gray-12)]'
                  }`}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  AI
                </button>
              )}
              {!readOnly && !localMode && (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeSidebarTab === 'tags'}
                  onClick={() => setActiveSidebarTab('tags')}
                  className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    activeSidebarTab === 'tags'
                      ? 'bg-[var(--accent-4)] text-[var(--accent-12)] shadow-sm'
                      : 'text-[var(--gray-11)] hover:text-[var(--gray-12)]'
                  }`}
                >
                  <Tag className="h-3.5 w-3.5" />
                  Tags
                </button>
              )}
            </div>
          </div>

          {activeSidebarTab === 'notes' ? (
            <div className="flex min-h-0 flex-grow flex-col overflow-hidden">
              <div className="flex-grow space-y-4 overflow-y-auto p-4">
                {notes.length === 0 && (
                  <div className="mx-auto mt-12 max-w-xs rounded-lg border border-dashed border-[var(--gray-6)] bg-[var(--gray-2)]/60 p-6 text-center">
                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--gray-6)] bg-[var(--gray-3)] text-[var(--accent-11)]">
                      <Highlighter className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-medium text-[var(--gray-12)]">No notes yet</p>
                    {!readOnly ? (
                      <>
                        <p className="mt-1.5 text-xs leading-5 text-[var(--gray-10)]">
                          Select any text in the article — a menu will appear to add a note or ask
                          AI.
                        </p>
                        <div className="mt-4 space-y-2 text-left">
                          <p className="text-[10px] font-semibold tracking-wide text-[var(--gray-9)] uppercase">
                            Example notes
                          </p>
                          <div className="rounded-md border border-green-500/20 bg-green-500/5 px-2.5 py-1.5">
                            <p className="text-[11px] leading-4 text-[var(--gray-11)]">
                              <span className="font-medium text-green-400">✓</span>{' '}
                              &ldquo;Contradicts the Q3 report — check if the dataset
                              differs.&rdquo;
                            </p>
                          </div>
                          <div className="rounded-md border border-[var(--gray-6)] bg-[var(--gray-3)]/60 px-2.5 py-1.5">
                            <p className="text-[11px] leading-4 text-[var(--gray-10)] line-through">
                              &ldquo;Interesting.&rdquo;
                            </p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="mt-1.5 text-xs leading-5 text-[var(--gray-10)]">
                        This shared article has no notes yet.
                      </p>
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
                    isActive={activeNoteId === note.id}
                  />
                ))}

                {!readOnly && notes.length > 0 && (
                  <div className="pt-1">
                    {sessionReview ? (
                      <SessionReviewPanel
                        review={sessionReview}
                        isRegenerating={isGeneratingReview}
                        onRegenerate={generateReview}
                      />
                    ) : (
                      <div className="space-y-1.5">
                        <button
                          type="button"
                          onClick={generateReview}
                          disabled={isGeneratingReview}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--accent-7)] bg-[var(--accent-2)]/40 px-3 py-2.5 text-xs font-medium text-[var(--accent-11)] transition-colors hover:border-[var(--accent-8)] hover:bg-[var(--accent-3)]/60 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          {isGeneratingReview ? 'Generating review…' : 'Generate Session Review'}
                        </button>
                        {reviewError && (
                          <p className="text-center text-[11px] text-red-400">{reviewError}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {notes.length > 1 && (
                <div className="shrink-0 border-t border-[var(--gray-5)] bg-[var(--gray-2)]/95 px-4 py-3 backdrop-blur">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => navigateNote('prev')}
                      disabled={
                        activeNoteId !== null && notes.findIndex((n) => n.id === activeNoteId) <= 0
                      }
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-[var(--gray-6)] bg-[var(--gray-3)] px-3 py-2 text-xs font-medium text-[var(--gray-12)] transition-colors hover:bg-[var(--gray-4)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => navigateNote('next')}
                      disabled={
                        activeNoteId !== null &&
                        notes.findIndex((n) => n.id === activeNoteId) >= notes.length - 1
                      }
                      className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-[var(--gray-6)] bg-[var(--gray-3)] px-3 py-2 text-xs font-medium text-[var(--gray-12)] transition-colors hover:bg-[var(--gray-4)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : activeSidebarTab === 'ai' && !readOnly && !localMode ? (
            <NotesAIChat
              article={article}
              notes={notes}
              queuedPrompt={queuedAIPrompt}
              onQueuedPromptHandled={() => setQueuedAIPrompt(null)}
            />
          ) : activeSidebarTab === 'tags' && !readOnly && !localMode ? (
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
              className="fixed z-[120] min-w-[196px] overflow-hidden rounded-lg border border-[var(--gray-6)] bg-[var(--gray-2)]/95 p-1 shadow-2xl backdrop-blur"
              style={{
                left: Math.min(selectionMenu.x, window.innerWidth - 200),
                top: Math.min(selectionMenu.y, window.innerHeight - 120),
              }}
            >
              <button
                type="button"
                onClick={addNoteFromSelection}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-gray-100 transition-colors hover:bg-[var(--gray-3)]"
              >
                <Highlighter className="h-3.5 w-3.5 text-[var(--accent-11)]" />
                Add note
              </button>
              {!localMode && (
                <button
                  type="button"
                  onClick={askAIFromSelection}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-gray-100 transition-colors hover:bg-[var(--gray-3)]"
                >
                  <Sparkles className="h-3.5 w-3.5 text-[var(--accent-11)]" />
                  Ask AI
                </button>
              )}
              {onSpawnNote && (
                <button
                  type="button"
                  onClick={spawnNoteFromSelection}
                  className="block w-full rounded-sm px-3 py-2 text-left text-sm text-gray-100 transition-colors hover:bg-[var(--gray-3)]"
                >
                  Add to Board
                </button>
              )}
              {onSpawnAIChat && (
                <button
                  type="button"
                  onClick={spawnAIChatFromSelection}
                  className="block w-full rounded-sm px-3 py-2 text-left text-sm text-gray-100 transition-colors hover:bg-[var(--gray-3)]"
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
