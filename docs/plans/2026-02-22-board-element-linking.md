# Board Element Linking Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the board with browser zoom prevention, element selection from parsed articles, element-linked notes/chats with chip+edge display, and shared storage between board and reader views.

**Architecture:** The board canvas (React Flow) gains an overlay `ElementPickerPanel` that renders parsed article HTML. Element selection creates NoteNode or AIChatNode linked via `ElementAnchor`. Board nodes sync notes/chats to `article.notes[]` and `article.aiChat[]` via a hook on auto-save. Auto-generated dashed edges visually connect linked nodes to their parent website node.

**Tech Stack:** Next.js 16, React 19, @xyflow/react, TypeScript, Tailwind CSS, Firebase/Firestore

---

### Task 1: Disable Browser Zoom Completely

**Files:**

- Modify: `src/components/board/BoardCanvasClient.tsx:69-92` (useSuppressBrowserZoom hook)

**Step 1: Extend the hook to handle gesture events and viewport meta**

In `useSuppressBrowserZoom()`, add handlers for `gesturestart`/`gesturechange` (Safari pinch-to-zoom) and dynamically set viewport meta on mount:

```typescript
function useSuppressBrowserZoom() {
  useEffect(() => {
    // Prevent Ctrl+scroll (browser zoom) — React Flow handles canvas zoom itself
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    // Prevent Ctrl+Plus/Minus browser zoom
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '0')
      ) {
        e.preventDefault();
      }
    };
    // Prevent Safari trackpad pinch-to-zoom
    const onGesture = (e: Event) => {
      e.preventDefault();
    };
    // Set viewport meta to prevent mobile/trackpad zoom
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
    const existingMeta = document.querySelector('meta[name="viewport"]');
    const previousContent = existingMeta?.getAttribute('content') ?? null;
    if (existingMeta) {
      existingMeta.setAttribute('content', meta.content);
    } else {
      document.head.appendChild(meta);
    }

    document.addEventListener('wheel', onWheel, { passive: false, capture: true });
    document.addEventListener('keydown', onKeyDown, { capture: true });
    document.addEventListener('gesturestart', onGesture, { capture: true });
    document.addEventListener('gesturechange', onGesture, { capture: true });

    return () => {
      document.removeEventListener('wheel', onWheel, { capture: true });
      document.removeEventListener('keydown', onKeyDown, { capture: true });
      document.removeEventListener('gesturestart', onGesture, { capture: true });
      document.removeEventListener('gesturechange', onGesture, { capture: true });
      // Restore original viewport meta
      if (previousContent !== null && existingMeta) {
        existingMeta.setAttribute('content', previousContent);
      } else if (!existingMeta) {
        meta.remove();
      }
    };
  }, []);
}
```

**Step 2: Add touch-action CSS to the board wrapper**

In `BoardCanvas` return, add `touch-action: none` to the root div:

```tsx
<div className="relative h-full w-full" style={{ touchAction: 'none' }}>
```

**Step 3: Verify by running the dev server**

Run: `pnpm dev`
Test: Open `/board/[id]`, try Ctrl+scroll, Ctrl+/-, pinch-to-zoom on trackpad. None should trigger browser zoom.

**Step 4: Commit**

```bash
git add src/components/board/BoardCanvasClient.tsx
git commit -m "fix(board): disable all browser zoom vectors on canvas"
```

---

### Task 2: Add ElementAnchor Type and Extend Board Data Types

**Files:**

- Modify: `src/types.ts`

**Step 1: Add `ElementAnchor` interface and extend board node data types**

Add after the existing `NoteAnchor` interface (line ~6):

```typescript
export interface ElementAnchor {
  articleId: string;
  websiteNodeId: string;
  elementIndex: number;
  tagName?: string;
  textPreview?: string;
}
```

Update `NoteNodeData`:

```typescript
export interface NoteNodeData {
  text: string;
  color: string;
  elementAnchor?: ElementAnchor;
}
```

Update `AIChatNodeData`:

```typescript
export interface AIChatNodeData {
  messages: AIChatMessage[];
  contextLabel?: string;
  elementAnchor?: ElementAnchor;
}
```

Update `AIChatMessage`:

```typescript
export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
  elementAnchor?: ElementAnchor;
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`
Expected: No new errors (all new fields are optional).

**Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat(types): add ElementAnchor and extend board node data types"
```

---

### Task 3: Update Board Service Sanitization for ElementAnchor

**Files:**

- Modify: `src/lib/boards-service.ts`

**Step 1: Add sanitizeElementAnchor helper**

Add before `sanitizeBoardNode`:

```typescript
function sanitizeElementAnchor(anchor: unknown): Record<string, unknown> | undefined {
  if (typeof anchor !== 'object' || anchor === null) return undefined;
  const a = anchor as Record<string, unknown>;

  const articleId = typeof a.articleId === 'string' ? a.articleId.trim() : '';
  const websiteNodeId = typeof a.websiteNodeId === 'string' ? a.websiteNodeId.trim() : '';
  const elementIndex = Number(a.elementIndex);

  if (!articleId || !websiteNodeId || !Number.isFinite(elementIndex) || elementIndex < 0) {
    return undefined;
  }

  const result: Record<string, unknown> = { articleId, websiteNodeId, elementIndex };
  if (typeof a.tagName === 'string') result.tagName = a.tagName.slice(0, 30);
  if (typeof a.textPreview === 'string')
    result.textPreview = sanitizePlainText(a.textPreview).slice(0, 200);
  return result;
}
```

**Step 2: Update note sanitization to pass through elementAnchor**

In the `type === 'note'` block, add:

```typescript
if (type === 'note') {
  const noteData: Record<string, unknown> = {
    text: sanitizePlainText(data.text).slice(0, MAX_NOTE_TEXT_LENGTH),
    color: typeof data.color === 'string' ? data.color.slice(0, 20) : 'yellow',
  };
  const anchor = sanitizeElementAnchor(data.elementAnchor);
  if (anchor) noteData.elementAnchor = anchor;
  return { ...base, type: 'note', data: noteData } as unknown as BoardNode;
}
```

**Step 3: Update aiChat sanitization to pass through elementAnchor on node and messages**

In the aiChat block, update message sanitization to preserve elementAnchor:

```typescript
const sanitizedMessages: AIChatMessage[] = messages
  .map((m: unknown) => {
    if (typeof m !== 'object' || m === null) return null;
    const msg = m as Record<string, unknown>;
    if (msg.role !== 'user' && msg.role !== 'assistant') return null;
    const content = sanitizePlainText(msg.content).slice(0, MAX_AI_MESSAGE_LENGTH);
    if (!content) return null;
    const result: Record<string, unknown> = { role: msg.role, content };
    const msgAnchor = sanitizeElementAnchor(msg.elementAnchor);
    if (msgAnchor) result.elementAnchor = msgAnchor;
    return result as unknown as AIChatMessage;
  })
  .filter((m): m is AIChatMessage => m !== null)
  .slice(-MAX_AI_MESSAGES_PER_NODE);

const chatData: Record<string, unknown> = { messages: sanitizedMessages };
if (typeof data.contextLabel === 'string') {
  chatData.contextLabel = sanitizePlainText(data.contextLabel).slice(0, 200);
}
const chatAnchor = sanitizeElementAnchor(data.elementAnchor);
if (chatAnchor) chatData.elementAnchor = chatAnchor;
```

**Step 4: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`

**Step 5: Commit**

```bash
git add src/lib/boards-service.ts
git commit -m "feat(boards): sanitize ElementAnchor on note and aiChat nodes"
```

---

### Task 4: Extract ANNOTATABLE_SELECTOR to Shared Constant

**Files:**

- Create: `src/lib/annotatable.ts`
- Modify: `src/components/ReaderClient.tsx` (import from shared)

**Step 1: Create the shared constant file**

```typescript
// src/lib/annotatable.ts
export const ANNOTATABLE_SELECTOR = [
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
```

**Step 2: Update ReaderClient.tsx to import from shared**

Remove lines 23-46 (the local `ANNOTATABLE_SELECTOR` definition) and add import:

```typescript
import { ANNOTATABLE_SELECTOR } from '../lib/annotatable';
```

**Step 3: Verify dev server still works**

Run: `pnpm dev`
Test: Open a Reader page and verify element annotation still works.

**Step 4: Commit**

```bash
git add src/lib/annotatable.ts src/components/ReaderClient.tsx
git commit -m "refactor: extract ANNOTATABLE_SELECTOR to shared lib"
```

---

### Task 5: Create ElementPickerPanel Component

**Files:**

- Create: `src/components/board/ElementPickerPanel.tsx`

This is the overlay side panel that shows parsed article HTML with hoverable/clickable elements.

**Step 1: Create the panel component**

```typescript
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { ANNOTATABLE_SELECTOR } from '../../lib/annotatable';
import type { Article, NoteAnchor } from '../../types';

interface ElementPickerPanelProps {
  articleId: string;
  websiteNodeId: string;
  onClose: () => void;
  onAddNote: (anchor: NoteAnchor & { articleId: string; websiteNodeId: string }, elementText: string) => void;
  onAskAI: (anchor: NoteAnchor & { articleId: string; websiteNodeId: string }, elementText: string) => void;
}

type ActionMenuState = {
  x: number;
  y: number;
  anchor: NoteAnchor & { articleId: string; websiteNodeId: string };
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
    setLoading(true);
    setError(null);

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

    return () => { cancelled = true; };
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
      // Wait for render
      requestAnimationFrame(initAnnotatableElements);
    }
  }, [article, initAnnotatableElements]);

  const handleElementClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
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
  }, [articleId, websiteNodeId]);

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

  // Dismiss action menu on scroll or escape
  useEffect(() => {
    const dismiss = () => setActionMenu(null);
    const onEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') { actionMenu ? setActionMenu(null) : onClose(); } };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [actionMenu, onClose]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-[480px] max-w-[90vw] flex-col border-l border-gray-700 bg-gray-950 shadow-2xl">
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
          {error && (
            <div className="px-4 py-10 text-center text-sm text-red-400">{error}</div>
          )}
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
      {actionMenu && typeof document !== 'undefined' && createPortal(
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
```

**Step 2: Add CSS for element picker hover state**

Add to `src/app/globals.css` (or wherever the board styles live):

```css
.element-picker-target {
  cursor: pointer;
  transition:
    outline 0.15s,
    background-color 0.15s;
  border-radius: 4px;
}
.element-picker-target:hover {
  outline: 2px solid rgba(96, 165, 250, 0.5);
  background-color: rgba(96, 165, 250, 0.08);
}
```

**Step 3: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`

**Step 4: Commit**

```bash
git add src/components/board/ElementPickerPanel.tsx src/app/globals.css
git commit -m "feat(board): add ElementPickerPanel overlay for article browsing"
```

---

### Task 6: Add "Browse Content" Button to WebsiteNode

**Files:**

- Modify: `src/components/board/nodes/WebsiteNode.tsx`

**Step 1: Add Browse content button and callback**

The WebsiteNode needs to communicate up to the board canvas that the user wants to open the element picker. Use a callback passed via React Flow node data.

Update the `WebsiteData` type:

```typescript
type WebsiteData = {
  url: string;
  title: string;
  excerpt: string;
  favicon?: string;
  articleId?: string;
  onBrowseContent?: (articleId: string, websiteNodeId: string) => void;
};
```

Add `id` to the destructured NodeProps and add the Browse button in the footer:

```typescript
function WebsiteNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as WebsiteData;
  // ... existing code ...

  return (
    <div ...>
      {/* ... existing header and content ... */}

      {nodeData.articleId && (
        <div className="flex items-center gap-2 border-t border-gray-800 px-3 py-1.5">
          <a
            href={`/reader/${nodeData.articleId}`}
            className="text-xs text-blue-400 hover:text-blue-300"
            onClick={(e) => e.stopPropagation()}
          >
            Open in Reader
          </a>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onBrowseContent?.(nodeData.articleId!, id);
            }}
            className="ml-auto text-xs text-gray-500 hover:text-blue-400 transition-colors"
          >
            Browse content
          </button>
        </div>
      )}
      {/* ... handle ... */}
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`

**Step 3: Commit**

```bash
git add src/components/board/nodes/WebsiteNode.tsx
git commit -m "feat(board): add Browse content button to WebsiteNode"
```

---

### Task 7: Wire ElementPickerPanel into BoardCanvasClient

**Files:**

- Modify: `src/components/board/BoardCanvasClient.tsx`

**Step 1: Add state and handlers for element picker**

Add imports:

```typescript
import { ElementPickerPanel } from './ElementPickerPanel';
import type { NoteAnchor } from '../../types';
```

Add state inside `BoardCanvas`:

```typescript
const [pickerState, setPickerState] = useState<{
  articleId: string;
  websiteNodeId: string;
} | null>(null);
```

Add handler for opening the picker (called from WebsiteNode):

```typescript
const openElementPicker = useCallback((articleId: string, websiteNodeId: string) => {
  setPickerState({ articleId, websiteNodeId });
}, []);
```

**Step 2: Inject onBrowseContent callback into website nodes**

Modify the `onNodesChange` area — we need to inject the callback into website node data. The cleanest approach: use a wrapper in `nodeTypes` or inject via `setNodes`. However, since React Flow passes data as-is, we'll inject it when creating nodes.

Update `addWebsiteNode`:

```typescript
const addWebsiteNode = useCallback(
  (data: { url: string; title: string; excerpt: string; favicon?: string; articleId?: string }) => {
    const position = getViewportCenter();
    const newNode: Node = {
      id: nextId('web'),
      type: 'website',
      position,
      data: { ...data, onBrowseContent: openElementPicker },
    };
    setNodes((nds) => [...nds, newNode]);
  },
  [nextId, getViewportCenter, setNodes, openElementPicker]
);
```

Also inject it on hydration — modify `hydrateNodes` to accept the callback, or inject after hydration via an effect. The simplest: inject in an effect that updates website nodes with the callback:

```typescript
// Inject onBrowseContent into all website nodes on mount
useEffect(() => {
  setNodes((nds) =>
    nds.map((n) =>
      n.type === 'website' ? { ...n, data: { ...n.data, onBrowseContent: openElementPicker } } : n
    )
  );
}, [openElementPicker, setNodes]);
```

**Step 3: Add handlers for "Add Note" and "Ask AI" from element picker**

```typescript
const handlePickerAddNote = useCallback(
  (anchor: NoteAnchor & { articleId: string; websiteNodeId: string }, elementText: string) => {
    // Find the website node to position near it
    const websiteNode = nodes.find((n) => n.id === anchor.websiteNodeId);
    const position = websiteNode
      ? {
          x: websiteNode.position.x + (websiteNode.measured?.width ?? 250) + 40,
          y: websiteNode.position.y,
        }
      : getViewportCenter();

    const newNode: Node = {
      id: nextId('note'),
      type: 'note',
      position,
      data: {
        text: elementText,
        color: 'blue',
        elementAnchor: {
          articleId: anchor.articleId,
          websiteNodeId: anchor.websiteNodeId,
          elementIndex: anchor.elementIndex,
          tagName: anchor.tagName,
          textPreview: anchor.textPreview,
        },
      },
    };
    setNodes((nds) => [...nds, newNode]);

    // Add auto edge
    setEdges((eds) => [
      ...eds,
      {
        id: `link-${newNode.id}-${anchor.websiteNodeId}`,
        source: anchor.websiteNodeId,
        target: newNode.id,
        type: 'labeled',
        data: {
          label: `${anchor.tagName || 'element'}`,
          style: 'dashed',
        },
      },
    ]);

    setPickerState(null);
  },
  [nodes, getViewportCenter, nextId, setNodes, setEdges]
);

const handlePickerAskAI = useCallback(
  (anchor: NoteAnchor & { articleId: string; websiteNodeId: string }, elementText: string) => {
    const websiteNode = nodes.find((n) => n.id === anchor.websiteNodeId);
    const position = websiteNode
      ? {
          x: websiteNode.position.x + (websiteNode.measured?.width ?? 250) + 40,
          y: websiteNode.position.y + 100,
        }
      : getViewportCenter();

    const contextMessage: AIChatMessage = {
      role: 'user',
      content: `Explain this element from the article:\n\n"${elementText}"`,
      elementAnchor: {
        articleId: anchor.articleId,
        websiteNodeId: anchor.websiteNodeId,
        elementIndex: anchor.elementIndex,
        tagName: anchor.tagName,
        textPreview: anchor.textPreview,
      },
    };

    const newNode: Node = {
      id: nextId('chat'),
      type: 'aiChat',
      position,
      data: {
        messages: [contextMessage],
        contextLabel: `Re: ${anchor.tagName || 'element'} — "${(anchor.textPreview || '').slice(0, 60)}"`,
        elementAnchor: {
          articleId: anchor.articleId,
          websiteNodeId: anchor.websiteNodeId,
          elementIndex: anchor.elementIndex,
          tagName: anchor.tagName,
          textPreview: anchor.textPreview,
        },
      },
    };
    setNodes((nds) => [...nds, newNode]);

    // Add auto edge
    setEdges((eds) => [
      ...eds,
      {
        id: `link-${newNode.id}-${anchor.websiteNodeId}`,
        source: anchor.websiteNodeId,
        target: newNode.id,
        type: 'labeled',
        data: {
          label: `${anchor.tagName || 'element'}`,
          style: 'dashed',
        },
      },
    ]);

    setPickerState(null);
  },
  [nodes, getViewportCenter, nextId, setNodes, setEdges]
);
```

Add the AIChatMessage import:

```typescript
import type { Board, AIChatMessage } from '../../types';
```

**Step 4: Render the panel**

Add after `AddWebsiteDialog` in the return:

```tsx
{
  pickerState && (
    <ElementPickerPanel
      articleId={pickerState.articleId}
      websiteNodeId={pickerState.websiteNodeId}
      onClose={() => setPickerState(null)}
      onAddNote={handlePickerAddNote}
      onAskAI={handlePickerAskAI}
    />
  );
}
```

**Step 5: Verify dev server works end-to-end**

Run: `pnpm dev`
Test: Add a website card, click "Browse content", hover elements, click an element, see action menu, click "Add Note" — new note node should appear with dashed edge.

**Step 6: Commit**

```bash
git add src/components/board/BoardCanvasClient.tsx
git commit -m "feat(board): wire element picker with note/chat creation and auto-edges"
```

---

### Task 8: Add ElementAnchor Chip to NoteNode

**Files:**

- Modify: `src/components/board/nodes/NoteNode.tsx`

**Step 1: Extend NoteData type and add chip display**

Update the local type:

```typescript
type NoteData = {
  text: string;
  color: string;
  elementAnchor?: {
    articleId: string;
    websiteNodeId: string;
    elementIndex: number;
    tagName?: string;
    textPreview?: string;
  };
  onBrowseContent?: (articleId: string, websiteNodeId: string) => void;
};
```

Add a chip before the text area in the template (inside the `<div className="p-3">` block):

```tsx
{
  nodeData.elementAnchor && (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        nodeData.onBrowseContent?.(
          nodeData.elementAnchor!.articleId,
          nodeData.elementAnchor!.websiteNodeId
        );
      }}
      className="mb-2 inline-flex items-center gap-1 rounded-md bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-300 hover:bg-blue-500/25 transition-colors max-w-full"
    >
      <span className="font-mono">[{nodeData.elementAnchor.tagName || 'el'}]</span>
      <span className="truncate">
        &ldquo;{(nodeData.elementAnchor.textPreview || '').slice(0, 50)}&rdquo;
      </span>
    </button>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/board/nodes/NoteNode.tsx
git commit -m "feat(board): show element anchor chip on NoteNode"
```

---

### Task 9: Add ElementAnchor Chip to AIChatNode

**Files:**

- Modify: `src/components/board/nodes/AIChatNode.tsx`

**Step 1: Extend AIChatData and add chip**

Update the local type:

```typescript
type AIChatData = {
  messages: AIChatMessage[];
  contextLabel?: string;
  elementAnchor?: {
    articleId: string;
    websiteNodeId: string;
    elementIndex: number;
    tagName?: string;
    textPreview?: string;
  };
  onBrowseContent?: (articleId: string, websiteNodeId: string) => void;
};
```

Add a chip below the header bar (after the `</div>` closing the header, before the messages area):

```tsx
{
  nodeData.elementAnchor && (
    <div className="border-b border-gray-800 px-3 py-1.5">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          nodeData.onBrowseContent?.(
            nodeData.elementAnchor!.articleId,
            nodeData.elementAnchor!.websiteNodeId
          );
        }}
        className="inline-flex items-center gap-1 rounded-md bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-300 hover:bg-blue-500/25 transition-colors max-w-full"
      >
        <span className="font-mono">[{nodeData.elementAnchor.tagName || 'el'}]</span>
        <span className="truncate">
          &ldquo;{(nodeData.elementAnchor.textPreview || '').slice(0, 50)}&rdquo;
        </span>
      </button>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/board/nodes/AIChatNode.tsx
git commit -m "feat(board): show element anchor chip on AIChatNode"
```

---

### Task 10: Inject onBrowseContent into Note and AIChat Nodes

**Files:**

- Modify: `src/components/board/BoardCanvasClient.tsx`

**Step 1: Extend the hydration effect to inject onBrowseContent into all node types that support it**

Update the existing injection effect to also cover note and aiChat nodes:

```typescript
useEffect(() => {
  setNodes((nds) =>
    nds.map((n) => {
      if (n.type === 'website' || n.type === 'note' || n.type === 'aiChat') {
        return { ...n, data: { ...n.data, onBrowseContent: openElementPicker } };
      }
      return n;
    })
  );
}, [openElementPicker, setNodes]);
```

Also update `addNoteNode` (for manually created notes without anchor, no change needed since they won't have onBrowseContent by default — but for consistency, add it):

The injection effect handles it for all nodes. Also update `handlePickerAddNote` and `handlePickerAskAI` to include `onBrowseContent` in the data.

**Step 2: Verify chip clicking opens the picker**

Run: `pnpm dev`
Test: Create a note from element picker, verify the chip shows, click it, verify picker opens.

**Step 3: Commit**

```bash
git add src/components/board/BoardCanvasClient.tsx
git commit -m "feat(board): inject onBrowseContent callback into all nodes"
```

---

### Task 11: Create Article Sync Hook (useBoardArticleSync)

**Files:**

- Create: `src/components/board/hooks/useBoardArticleSync.ts`

This hook watches board nodes and syncs element-anchored notes and chats to the article's `notes[]` and `aiChat[]`.

**Step 1: Create the sync hook**

```typescript
import { useEffect, useRef, useCallback } from 'react';
import type { Node } from '@xyflow/react';
import type { Note, AIChatMessage, NoteAnchor } from '../../../types';

const SYNC_DEBOUNCE_MS = 2000;

interface SyncableNoteData {
  text: string;
  elementAnchor?: {
    articleId: string;
    websiteNodeId: string;
    elementIndex: number;
    tagName?: string;
    textPreview?: string;
  };
}

interface SyncableChatData {
  messages: AIChatMessage[];
  elementAnchor?: {
    articleId: string;
    websiteNodeId: string;
    elementIndex: number;
    tagName?: string;
    textPreview?: string;
  };
}

/**
 * Syncs board note nodes (with elementAnchor) to article.notes[]
 * and board aiChat nodes (with elementAnchor) to article.aiChat[].
 */
export function useBoardArticleSync(nodes: Node[]) {
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastSyncedRef = useRef<Map<string, string>>(new Map());

  const syncArticle = useCallback(
    async (articleId: string, notes: Note[], aiChat: AIChatMessage[]) => {
      const payload: Record<string, unknown> = {};
      if (notes.length > 0) payload.notes = notes;
      if (aiChat.length > 0) payload.aiChat = aiChat;
      if (Object.keys(payload).length === 0) return;

      try {
        await fetch(`/api/articles/${articleId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (err) {
        console.error('Board article sync failed:', err);
      }
    },
    []
  );

  useEffect(() => {
    // Group nodes by articleId
    const articleNotes = new Map<string, Note[]>();
    const articleChats = new Map<string, AIChatMessage[]>();

    for (const node of nodes) {
      if (node.type === 'note') {
        const data = node.data as unknown as SyncableNoteData;
        if (!data.elementAnchor?.articleId) continue;
        const aid = data.elementAnchor.articleId;

        const existing = articleNotes.get(aid) || [];
        const anchor: NoteAnchor = {
          elementIndex: data.elementAnchor.elementIndex,
          tagName: data.elementAnchor.tagName,
          textPreview: data.elementAnchor.textPreview,
        };
        existing.push({
          id: existing.length + 1,
          text: data.text || '',
          anchor,
        });
        articleNotes.set(aid, existing);
      }

      if (node.type === 'aiChat') {
        const data = node.data as unknown as SyncableChatData;
        if (!data.elementAnchor?.articleId) continue;
        const aid = data.elementAnchor.articleId;

        const existing = articleChats.get(aid) || [];
        existing.push(...data.messages);
        articleChats.set(aid, existing);
      }
    }

    // For each article, debounce sync
    const allArticleIds = new Set([...articleNotes.keys(), ...articleChats.keys()]);

    for (const articleId of allArticleIds) {
      const notes = articleNotes.get(articleId) || [];
      const chats = articleChats.get(articleId) || [];
      const serialized = JSON.stringify({ notes, chats });

      if (serialized === lastSyncedRef.current.get(articleId)) continue;

      // Clear existing timeout for this article
      const existing = timeoutsRef.current.get(articleId);
      if (existing) clearTimeout(existing);

      timeoutsRef.current.set(
        articleId,
        setTimeout(() => {
          lastSyncedRef.current.set(articleId, serialized);
          void syncArticle(articleId, notes, chats);
        }, SYNC_DEBOUNCE_MS)
      );
    }

    return () => {
      // Don't clear on every render — only on unmount
    };
  }, [nodes, syncArticle]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const timeout of timeoutsRef.current.values()) {
        clearTimeout(timeout);
      }
    };
  }, []);
}
```

**Step 2: Wire into BoardCanvasClient**

In `BoardCanvas`, add:

```typescript
import { useBoardArticleSync } from './hooks/useBoardArticleSync';

// Inside the component:
useBoardArticleSync(nodes);
```

**Step 3: Verify TypeScript compiles**

Run: `pnpm exec tsc --noEmit`

**Step 4: Commit**

```bash
git add src/components/board/hooks/useBoardArticleSync.ts src/components/board/BoardCanvasClient.tsx
git commit -m "feat(board): add article sync hook for element-linked notes and chats"
```

---

### Task 12: Integration Testing and Polish

**Files:**

- Possibly modify: various files for bug fixes found during testing

**Step 1: Full end-to-end manual test**

Run: `pnpm dev`

Test flow:

1. Go to `/board`, create or open a board
2. Verify browser zoom is disabled (Ctrl+scroll, Ctrl+/-, pinch)
3. Add a website via "Add Website" → "Save as Card"
4. Click "Browse content" on the website card
5. Hover elements in the picker panel — verify blue outline
6. Click an element — verify action menu appears
7. Click "Add Note" — verify:
   - New blue note node appears next to website card
   - Dashed edge connects note to website
   - Note shows element anchor chip with [tagName] "preview..."
8. Click the chip on the note — verify picker re-opens
9. Go back to picker, click element, click "Ask AI" — verify:
   - New AI Chat node appears with context message
   - Dashed edge connects chat to website
   - Chat shows element anchor chip
10. Open the same article in Reader — verify board-created notes appear in the Reader sidebar

**Step 2: Fix any issues found during testing**

This step depends on testing outcomes. Common things to fix:

- CSS z-index conflicts between picker panel and React Flow controls
- Action menu positioning near edges of viewport
- Auto-save serialization stripping `onBrowseContent` function (should already work via cleanNodeData)

**Step 3: Final commit**

```bash
git add -u
git commit -m "feat(board): element linking integration polish"
```

---

## Summary of All Files

| Action | File                                                |
| ------ | --------------------------------------------------- |
| Modify | `src/components/board/BoardCanvasClient.tsx`        |
| Modify | `src/types.ts`                                      |
| Modify | `src/lib/boards-service.ts`                         |
| Modify | `src/components/board/nodes/WebsiteNode.tsx`        |
| Modify | `src/components/board/nodes/NoteNode.tsx`           |
| Modify | `src/components/board/nodes/AIChatNode.tsx`         |
| Modify | `src/components/ReaderClient.tsx`                   |
| Modify | `src/app/globals.css`                               |
| Create | `src/lib/annotatable.ts`                            |
| Create | `src/components/board/ElementPickerPanel.tsx`       |
| Create | `src/components/board/hooks/useBoardArticleSync.ts` |
