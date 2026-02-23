# Reader Node + Article Sharing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a full-reader canvas node type and public article sharing.

**Architecture:** Extract shared reader logic from `ReaderClient` into `ReaderCore`. Build a `ReaderNode` that wraps `ReaderCore` inside a ReactFlow node. Article sharing follows the same `shareId` token pattern as boards. Shared boards hydrate reader node content server-side.

**Tech Stack:** Next.js App Router, ReactFlow, Firebase Admin, TanStack Query, crypto.randomBytes

---

### Task 1: Add Types

**Files:**

- Modify: `src/types.ts:94-127`

**Step 1: Add ReaderNodeData and update BoardNode**

In `src/types.ts`, add a new interface after `IframeNodeData` (line 118) and update the `BoardNode` union:

```typescript
export interface ReaderNodeData {
  articleId: string;
  url: string;
  title: string;
}
```

Update `BoardNode.type` union to include `'reader'`:

```typescript
export interface BoardNode {
  id: string;
  type: 'website' | 'note' | 'aiChat' | 'iframe' | 'reader';
  position: { x: number; y: number };
  data: WebsiteNodeData | NoteNodeData | AIChatNodeData | IframeNodeData | ReaderNodeData;
  width?: number;
  height?: number;
}
```

**Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat(types): add ReaderNodeData and reader to BoardNode union"
```

---

### Task 2: Extract ReaderCore from ReaderClient

**Files:**

- Create: `src/components/reader/ReaderCore.tsx`
- Modify: `src/components/ReaderClient.tsx`

This is the largest task. The goal is to extract all the reader logic (article rendering, annotation markers, text selection menu, note CRUD, sidebar tabs) into a self-contained `ReaderCore` component, then make `ReaderClient` a thin wrapper.

**Step 1: Create `src/components/reader/ReaderCore.tsx`**

The component accepts a pre-fetched `Article` and renders the full reader experience without any page-level concerns (no `Navbar`, no routing, no data fetching).

```typescript
'use client';

import { useState, useRef, useEffect, useCallback, memo, startTransition, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Article, Note, ReaderSettings } from '../../types';
import { ReaderView, getThemeClasses } from '../ReaderView';
import { AppearanceToolbar } from '../AppearanceToolbar';
import { NotesAIChat } from '../NotesAIChat';
import { ArticleTagEditor } from '../ArticleTagEditor';
import { ArticleSummary } from '../ArticleSummary';
import { ANNOTATABLE_SELECTOR } from '../../lib/annotatable';
import {
  AI_CONFIG_STORAGE_KEY,
  AIConfig,
  DEFAULT_AI_CONFIG,
  isLocalCLIEnabled,
  normalizeAvailableAIProvider,
  getDefaultModelForProvider,
} from '../../lib/ai-config';
```

**Props interface:**

```typescript
interface ReaderCoreProps {
  article: Article;
  readOnly?: boolean;
  /** Called when notes/title/etc change and are persisted. */
  onArticleUpdate?: (updates: Partial<Article>) => void;
  /** Board integration: spawn a note node on the canvas. */
  onSpawnNote?: (anchor: import('../../types').ElementAnchor, text: string) => void;
  /** Board integration: spawn an AI chat node on the canvas. */
  onSpawnAIChat?: (anchor: import('../../types').ElementAnchor, text: string) => void;
  /** Compact mode for embedding inside a ReactFlow node. Hides some chrome. */
  compact?: boolean;
}
```

Extract from `ReaderClient.tsx` lines 58-957 into this component, with these changes:

1. **Remove** `useQuery` for article fetching — article is passed as prop.
2. **Remove** `useRouter`, `Navbar`, back button, routing.
3. **Remove** the `if (isArticleLoading)` / `if (articleError)` / `if (!article)` guards — caller handles loading state.
4. **Remove** the outer `div` with `h-screen` — just render the two panels. The caller controls sizing.
5. **Keep** everything else: `notes` state, `persistNotes` mutation, `persistTitle` mutation, `refreshAnnotationTargets`, text selection menu, `NoteMarkerGroup`, sidebar tabs, `ArticleSummary`, `AppearanceToolbar`.
6. **Add** `readOnly` guard: when true, skip title editing, hide selection menu, disable note delete/edit buttons, hide appearance toolbar, show sidebar in view-only mode (no AI input, no tag editing).
7. **Add** `onSpawnNote`/`onSpawnAIChat` callbacks: In the selection action menu, if these are provided, add "Add to Board" / "Ask AI on Board" buttons that call these callbacks with an `ElementAnchor` (constructed from `articleId` + a placeholder `websiteNodeId` + element anchor data) and the selected text. If not provided, behave as before (inline note / sidebar AI chat).
8. **When `compact` is true**: Hide the panel resizer and render sidebar as a toggleable overlay rather than a fixed side panel. This is used inside the ReactFlow node where space is constrained.
9. **Move** `NoteMarkerGroup`, `NoteMarkerGroupMemo`, `NoteCard` into the same file (they are only used here).
10. **Keep** `loadAIConfig` as a module-level function in this file.

The outer structure should be:

```tsx
export function ReaderCore({
  article,
  readOnly,
  onArticleUpdate,
  onSpawnNote,
  onSpawnAIChat,
  compact,
}: ReaderCoreProps) {
  // All existing state/hooks from ReaderClient
  // ...

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* LEFT: Article content */}
      <div
        className={`flex flex-col overflow-hidden ${compact ? 'flex-1' : ''}`}
        style={compact ? undefined : { width: `${leftPanelWidth}%` }}
      >
        {/* Header: title + appearance + save status */}
        {/* ... */}
        {/* Article content with ReaderView + note markers */}
        {/* ... */}
      </div>

      {/* RESIZER (hidden in compact mode) */}
      {!compact && <div className="w-1 ..." onMouseDown={startResizing} />}

      {/* RIGHT: Sidebar */}
      {/* In compact mode: collapsible panel toggled by a button */}
      {/* In full mode: fixed right panel */}
      {/* ... */}
    </div>
  );
}
```

**Step 2: Refactor `ReaderClient.tsx` to use `ReaderCore`**

Replace the 900+ lines of logic with:

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Navbar } from './Navbar';
import { ReaderCore } from './reader/ReaderCore';
import type { Article } from '../types';

export default function ReaderClient({ articleId }: { articleId: string }) {
  const router = useRouter();

  const { data: article, isLoading, error } = useQuery<Article>({
    queryKey: ['article', articleId],
    queryFn: async () => {
      const response = await fetch(`/api/articles/${articleId}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error('NOT_FOUND');
        throw new Error('Failed to fetch article');
      }
      return response.json();
    },
    enabled: Boolean(articleId),
  });

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading article...</p>
        </div>
      </div>
    );
  }

  if (error && !article) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-900 text-gray-200 gap-4">
        <p>{(error as Error).message === 'NOT_FOUND' ? 'Document not found.' : 'Failed to load article.'}</p>
        <button onClick={() => router.push('/')} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition">
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
        <ReaderCore article={article} />
      </div>
    </div>
  );
}
```

**Step 3: Verify standalone reader still works**

```bash
pnpm build
```

Navigate to `/reader/[any-article-id]` and verify: content renders, notes work, AI chat works, title editing works, text selection menu works, appearance toolbar works.

**Step 4: Commit**

```bash
git add src/components/reader/ReaderCore.tsx src/components/ReaderClient.tsx
git commit -m "refactor: extract ReaderCore from ReaderClient"
```

---

### Task 3: Build ReaderNode Component

**Files:**

- Create: `src/components/board/nodes/ReaderNode.tsx`

**Step 1: Create the ReaderNode**

This is a ReactFlow node that fetches an article and renders `ReaderCore` in compact mode. Uses `useQuery` to fetch the article. Has resize handles.

```typescript
'use client';

import { memo, useCallback } from 'react';
import { Handle, Position, NodeProps, NodeResizeControl } from '@xyflow/react';
import { useQuery } from '@tanstack/react-query';
import { GripVertical } from 'lucide-react';
import { ReaderCore } from '../../reader/ReaderCore';
import type { Article, ElementAnchor } from '../../../types';

type ReaderData = {
  articleId: string;
  url: string;
  title: string;
  readOnly?: boolean;
  readerNodeId?: string;
  onSpawnNote?: (anchor: ElementAnchor, text: string) => void;
  onSpawnAIChat?: (anchor: ElementAnchor, text: string) => void;
};

function ReaderNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as ReaderData;

  const { data: article, isLoading, error } = useQuery<Article>({
    queryKey: ['article', nodeData.articleId],
    queryFn: async () => {
      const res = await fetch(`/api/articles/${nodeData.articleId}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    enabled: Boolean(nodeData.articleId),
    staleTime: 30_000,
  });

  const handleSpawnNote = useCallback(
    (anchor: ElementAnchor, text: string) => {
      // Override websiteNodeId with this reader node's id
      nodeData.onSpawnNote?.({ ...anchor, websiteNodeId: id }, text);
    },
    [id, nodeData]
  );

  const handleSpawnAIChat = useCallback(
    (anchor: ElementAnchor, text: string) => {
      nodeData.onSpawnAIChat?.({ ...anchor, websiteNodeId: id }, text);
    },
    [id, nodeData]
  );

  return (
    <div
      className={`rounded-xl border bg-gray-900/95 shadow-lg overflow-hidden ${
        selected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-gray-700'
      }`}
      style={{ width: '100%', height: '100%', minWidth: 400, minHeight: 300 }}
    >
      <Handle type="target" position={Position.Top} className="!bg-gray-500 !w-2 !h-2" />

      {!nodeData.readOnly && (
        <NodeResizeControl
          minWidth={400}
          minHeight={300}
          style={{ background: 'transparent', border: 'none' }}
        >
          <GripVertical className="h-3 w-3 text-gray-600" />
        </NodeResizeControl>
      )}

      <div className="h-full w-full overflow-hidden">
        {isLoading && (
          <div className="flex h-full items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        )}
        {error && (
          <div className="flex h-full items-center justify-center text-gray-500 text-sm">
            Failed to load article
          </div>
        )}
        {article && (
          <div className="h-full nodrag nowheel">
            <ReaderCore
              article={article}
              readOnly={nodeData.readOnly}
              compact
              onSpawnNote={nodeData.readOnly ? undefined : handleSpawnNote}
              onSpawnAIChat={nodeData.readOnly ? undefined : handleSpawnAIChat}
            />
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-gray-500 !w-2 !h-2" />
    </div>
  );
}

export const ReaderNode = memo(ReaderNodeComponent);
```

Key details:

- `nodrag nowheel` classes on the content wrapper prevent ReactFlow from intercepting scroll/drag inside the reader.
- `NodeResizeControl` from `@xyflow/react` adds a resize handle.
- `staleTime: 30_000` avoids excessive refetches of the same article.
- `websiteNodeId` in the anchor is overridden with the reader node's `id` so spawned note/chat nodes link back to the reader node, not a non-existent website node.

**Step 2: Commit**

```bash
git add src/components/board/nodes/ReaderNode.tsx
git commit -m "feat(board): add ReaderNode component"
```

---

### Task 4: Register ReaderNode in BoardCanvasClient

**Files:**

- Modify: `src/components/board/BoardCanvasClient.tsx`

**Step 1: Import and register**

Add import at top:

```typescript
import { ReaderNode } from './nodes/ReaderNode';
```

Add to `nodeTypes` (line 40-45):

```typescript
const nodeTypes: NodeTypes = {
  note: NoteNode,
  website: WebsiteNode,
  aiChat: AIChatNode,
  iframe: IframeNode,
  reader: ReaderNode,
};
```

**Step 2: Add `addReaderNode` function**

After `addIframeNode` (around line 264), add:

```typescript
const addReaderNode = useCallback(
  (articleId: string, url: string, title: string, nearNodeId?: string) => {
    const nearNode = nearNodeId ? getNodes().find((n) => n.id === nearNodeId) : undefined;
    const position = nearNode
      ? {
          x: nearNode.position.x + (nearNode.measured?.width ?? 280) + 60,
          y: nearNode.position.y,
        }
      : getViewportCenter();

    const newNode: Node = {
      id: nextId('reader'),
      type: 'reader',
      position,
      data: {
        articleId,
        url,
        title,
        onSpawnNote: handleReaderSpawnNote,
        onSpawnAIChat: handleReaderSpawnAIChat,
      },
      width: 700,
      height: 500,
    };
    setNodes((nds) => [...nds, newNode]);

    // Connect to the website node if spawned from one
    if (nearNodeId) {
      setEdges((eds) => [
        ...eds,
        {
          id: `link-${newNode.id}-${nearNodeId}`,
          source: nearNodeId,
          target: newNode.id,
          type: 'labeled',
          data: { label: '', style: 'solid' },
        },
      ]);
    }
  },
  [nextId, getViewportCenter, getNodes, setNodes, setEdges]
);
```

**Step 3: Add reader spawn callbacks**

These are called when a user selects text inside a ReaderNode and clicks "Add to Board" / "Ask AI on Board". They create note/chat nodes adjacent to the reader node, same pattern as `handlePickerAddNote`/`handlePickerAskAI` but using the reader node as the source:

```typescript
const handleReaderSpawnNote = useCallback(
  (anchor: ElementAnchor, elementText: string) => {
    const readerNode = getNodes().find((n) => n.id === anchor.websiteNodeId);
    const position = readerNode
      ? {
          x: readerNode.position.x + (readerNode.measured?.width ?? 700) + 40,
          y: readerNode.position.y,
        }
      : getViewportCenter();

    const newNode: Node = {
      id: nextId('note'),
      type: 'note',
      position,
      data: {
        text: elementText,
        color: 'blue',
        elementAnchor: anchor,
        onBrowseContent: openElementPicker,
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setEdges((eds) => [
      ...eds,
      {
        id: `link-${newNode.id}-${anchor.websiteNodeId}`,
        source: anchor.websiteNodeId,
        target: newNode.id,
        type: 'labeled',
        data: { label: anchor.tagName || 'element', style: 'dashed' },
      },
    ]);
  },
  [getNodes, getViewportCenter, nextId, setNodes, setEdges, openElementPicker]
);

const handleReaderSpawnAIChat = useCallback(
  (anchor: ElementAnchor, elementText: string) => {
    const readerNode = getNodes().find((n) => n.id === anchor.websiteNodeId);
    const position = readerNode
      ? {
          x: readerNode.position.x + (readerNode.measured?.width ?? 700) + 40,
          y: readerNode.position.y + 100,
        }
      : getViewportCenter();

    const contextMessage: AIChatMessage = {
      role: 'user',
      content: `Explain this element from the article:\n\n"${elementText}"`,
      elementAnchor: anchor,
    };

    const newNode: Node = {
      id: nextId('chat'),
      type: 'aiChat',
      position,
      data: {
        messages: [contextMessage],
        contextLabel: `Re: ${anchor.tagName || 'element'} — "${(anchor.textPreview || '').slice(0, 60)}"`,
        elementAnchor: anchor,
        onBrowseContent: openElementPicker,
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setEdges((eds) => [
      ...eds,
      {
        id: `link-${newNode.id}-${anchor.websiteNodeId}`,
        source: anchor.websiteNodeId,
        target: newNode.id,
        type: 'labeled',
        data: { label: anchor.tagName || 'element', style: 'dashed' },
      },
    ]);
  },
  [getNodes, getViewportCenter, nextId, setNodes, setEdges, openElementPicker]
);
```

**Step 4: Inject callbacks into reader nodes**

Update the `useEffect` that injects `onBrowseContent` (line 178-189) to also handle reader nodes:

```typescript
useEffect(() => {
  if (readOnly) return;
  setNodes((nds) =>
    nds.map((n) => {
      if (n.type === 'website' || n.type === 'note' || n.type === 'aiChat') {
        return { ...n, data: { ...n.data, onBrowseContent: openElementPicker } };
      }
      if (n.type === 'reader') {
        return {
          ...n,
          data: {
            ...n.data,
            onSpawnNote: handleReaderSpawnNote,
            onSpawnAIChat: handleReaderSpawnAIChat,
          },
        };
      }
      return n;
    })
  );
}, [openElementPicker, handleReaderSpawnNote, handleReaderSpawnAIChat, readOnly]);
```

**Step 5: Pass `addReaderNode` to website nodes via `onOpenInBoard` callback**

Inject an `onOpenInBoard` callback into website node data (alongside `onBrowseContent`):

```typescript
// In the useEffect that injects callbacks:
if (n.type === 'website') {
  return {
    ...n,
    data: {
      ...n.data,
      onBrowseContent: openElementPicker,
      onOpenInBoard: addReaderNode,
    },
  };
}
```

**Step 6: Update MiniMap color**

In the `MiniMap` `nodeColor` function, add:

```typescript
if (node.type === 'reader') return '#f97316'; // orange
```

**Step 7: Commit**

```bash
git add src/components/board/BoardCanvasClient.tsx
git commit -m "feat(board): register ReaderNode and wire up spawn callbacks"
```

---

### Task 5: Update WebsiteNode with "Open in Board" Action

**Files:**

- Modify: `src/components/board/nodes/WebsiteNode.tsx`

**Step 1: Add `onOpenInBoard` to the data type**

```typescript
type WebsiteData = {
  url: string;
  title: string;
  excerpt: string;
  favicon?: string;
  articleId?: string;
  readOnly?: boolean;
  onBrowseContent?: (articleId: string, websiteNodeId: string) => void;
  onOpenInBoard?: (articleId: string, url: string, title: string, websiteNodeId: string) => void;
};
```

**Step 2: Replace "Browse content" with "Open in Board"**

Replace the footer section (lines 73-93) with:

```tsx
{
  nodeData.articleId && !nodeData.readOnly && (
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
          nodeData.onOpenInBoard?.(nodeData.articleId!, nodeData.url, nodeData.title, id);
        }}
        className="ml-auto text-xs text-gray-500 hover:text-blue-400 transition-colors"
      >
        Open in Board
      </button>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/components/board/nodes/WebsiteNode.tsx
git commit -m "feat(board): replace Browse content with Open in Board on WebsiteNode"
```

---

### Task 6: Update boards-service for Reader Nodes

**Files:**

- Modify: `src/lib/boards-service.ts`

**Step 1: Add reader node sanitization**

In the `sanitizeBoardNode` function, add a handler for the `reader` type. After the `iframe` block (line 88) and before the `// aiChat` comment:

```typescript
if (type === 'reader') {
  const readerData: Record<string, unknown> = {
    articleId: typeof data.articleId === 'string' ? data.articleId.trim() : '',
    url: sanitizePlainText(data.url).slice(0, 2048),
    title: sanitizeTitle(data.title, 'Untitled'),
  };
  if (!readerData.articleId) return null;
  return { ...base, type: 'reader', data: readerData } as unknown as BoardNode;
}
```

**Step 2: Update the type guard**

In `sanitizeBoardNode`, update the type check (line 42):

```typescript
if (
  type !== 'website' &&
  type !== 'note' &&
  type !== 'aiChat' &&
  type !== 'iframe' &&
  type !== 'reader'
)
  return null;
```

**Step 3: Commit**

```bash
git add src/lib/boards-service.ts
git commit -m "feat(boards-service): sanitize reader node type"
```

---

### Task 7: Article Sharing — Service Layer

**Files:**

- Modify: `src/lib/articles-service.ts`

**Step 1: Add imports**

At top of `src/lib/articles-service.ts`, add:

```typescript
import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
```

(The `Timestamp` import already exists at line 1. Add `FieldValue` to the same import.)

**Step 2: Add share functions at the bottom of the file**

```typescript
export async function generateArticleShareId(
  articleId: string,
  userId: string
): Promise<string | null> {
  const doc = await db.collection(ARTICLES_COLLECTION).doc(articleId).get();
  if (!doc.exists) return null;
  const data = doc.data()!;
  if (data.userId && data.userId !== userId) return null;

  if (data.shareId) return data.shareId as string;

  const shareId = crypto.randomBytes(16).toString('base64url');
  await db.collection(ARTICLES_COLLECTION).doc(articleId).update({ shareId });
  return shareId;
}

export async function revokeArticleShareId(articleId: string, userId: string): Promise<boolean> {
  const doc = await db.collection(ARTICLES_COLLECTION).doc(articleId).get();
  if (!doc.exists) return false;
  if (doc.data()!.userId !== userId) return false;

  await db.collection(ARTICLES_COLLECTION).doc(articleId).update({
    shareId: FieldValue.delete(),
  });
  return true;
}

export async function fetchArticleByShareId(
  shareId: string
): Promise<Omit<Article, 'userId' | 'id' | 'aiChat'> | null> {
  const snapshot = await db
    .collection(ARTICLES_COLLECTION)
    .where('shareId', '==', shareId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const data = snapshot.docs[0].data();

  return {
    url: data.url,
    title: data.title || data.url,
    byline: data.byline,
    content: data.content,
    notes: (data.notes ?? []).map((n: Record<string, unknown>) => ({
      id: Number(n.id) || 0,
      text: String(n.text || ''),
      anchor: n.anchor,
    })),
    aiSummary: typeof data.aiSummary === 'string' ? data.aiSummary : undefined,
    keyPoints: Array.isArray(data.keyPoints) ? data.keyPoints : undefined,
    tags: Array.isArray(data.tags) ? data.tags : [],
    readingTimeMinutes:
      typeof data.readingTimeMinutes === 'number' ? data.readingTimeMinutes : undefined,
    type: data.type || 'article',
    shareId: data.shareId,
    createdAt: data.createdAt?.toDate().toISOString(),
    updatedAt: data.updatedAt?.toDate().toISOString(),
  };
}
```

**Step 3: Commit**

```bash
git add src/lib/articles-service.ts
git commit -m "feat(articles-service): add share functions"
```

---

### Task 8: Article Sharing — API Routes

**Files:**

- Modify: `src/app/api/articles/[id]/route.ts`
- Create: `src/app/api/share/article/[shareId]/route.ts`

**Step 1: Add shareAction handling to the article PUT endpoint**

In `src/app/api/articles/[id]/route.ts`, add imports:

```typescript
import {
  // ... existing imports ...
  generateArticleShareId,
  revokeArticleShareId,
} from '../../../../lib/articles-service';
```

In the PUT handler, after the ownership check (line 71) and before `const body = await request.json()`, add the share action handling. Actually, `body` is already parsed at that point. After `const payload = body as Record<string, unknown>;` (line 77), add:

```typescript
if (payload.shareAction === 'generate') {
  const shareId = await generateArticleShareId(id, userId);
  if (!shareId)
    return NextResponse.json({ error: 'Failed to generate share link' }, { status: 500 });
  return NextResponse.json({ shareId });
}

if (payload.shareAction === 'revoke') {
  await revokeArticleShareId(id, userId);
  return NextResponse.json({ success: true });
}
```

**Step 2: Create public share endpoint**

Create `src/app/api/share/article/[shareId]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { fetchArticleByShareId } from '../../../../../lib/articles-service';

export async function GET(_request: Request, { params }: { params: Promise<{ shareId: string }> }) {
  try {
    const { shareId } = await params;
    if (!shareId || shareId.length > 30) {
      return NextResponse.json({ error: 'Invalid share link' }, { status: 400 });
    }

    const article = await fetchArticleByShareId(shareId);
    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    return NextResponse.json(article);
  } catch (error) {
    console.error('Error fetching shared article:', error);
    return NextResponse.json({ error: 'Failed to fetch article' }, { status: 500 });
  }
}
```

**Step 3: Commit**

```bash
git add src/app/api/articles/[id]/route.ts src/app/api/share/article/[shareId]/route.ts
git commit -m "feat(api): add article share endpoints"
```

---

### Task 9: Article Sharing — Public Page

**Files:**

- Create: `src/app/share/article/[shareId]/page.tsx`
- Create: `src/app/share/article/[shareId]/layout.tsx`

**Step 1: Create layout**

`src/app/share/article/[shareId]/layout.tsx` — reuse the same minimal layout pattern:

```typescript
export default function ShareArticleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col bg-gray-950">
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
```

**Step 2: Create page**

`src/app/share/article/[shareId]/page.tsx`:

```typescript
import { notFound } from 'next/navigation';
import { fetchArticleByShareId } from '../../../../lib/articles-service';
import { ReaderCore } from '../../../../components/reader/ReaderCore';
import type { Article } from '../../../../types';

export const dynamic = 'force-dynamic';

export default async function SharedArticlePage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const article = await fetchArticleByShareId(shareId);
  if (!article) {
    notFound();
  }

  // Dummy id/userId for type compat — neither is used in read-only mode
  const readOnlyArticle: Article = {
    ...article,
    id: '',
    userId: '',
    aiChat: [],
  };

  return (
    <div className="flex h-full overflow-hidden p-4 md:p-6">
      <ReaderCore article={readOnlyArticle} readOnly />
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add src/app/share/article/
git commit -m "feat: add public article share page"
```

---

### Task 10: Article Share UI in ReaderClient

**Files:**

- Modify: `src/components/ReaderClient.tsx`

**Step 1: Add share button to the ReaderClient header**

The standalone reader needs a Share button similar to the board toolbar. In the refactored `ReaderClient`, add a share button to the header area. Import `Share2` from lucide-react and reuse `ShareDialog` (or create a simpler `ArticleShareDialog` specific to articles).

For simplicity, create a minimal share button that:

1. Fetches the article's current `shareId` from the article data (add `shareId` to the `Article` type if not already there — it won't be in the type but will be in the Firestore data and returned by `fetchArticleById`).
2. Calls `PUT /api/articles/[id]` with `{ shareAction: 'generate' }` or `{ shareAction: 'revoke' }`.

Update `fetchArticleById` in `src/lib/articles-service.ts` to include `shareId` in the return value:

```typescript
// In fetchArticleById, add to the return object:
...(data.shareId ? { shareId: data.shareId } : {}),
```

Add `shareId?: string` to the `Article` interface in `src/types.ts`.

Then in `ReaderClient`, add a share button and dialog in the header bar. Follow the same pattern as `ShareDialog.tsx` but calling the article API instead of the board API.

**Step 2: Commit**

```bash
git add src/types.ts src/lib/articles-service.ts src/components/ReaderClient.tsx
git commit -m "feat(reader): add article share UI"
```

---

### Task 11: Build and Verify

**Files:** None (verification only)

**Step 1: Run build**

```bash
pnpm build
```

Fix any type errors that surface.

**Step 2: Manual verification checklist**

1. Standalone reader (`/reader/[id]`): content, notes, AI chat, tags, appearance, title edit all work.
2. Board: add website node → click "Open in Board" → reader node spawns with article content.
3. Reader node: select text → "Add to Board" → note node appears connected by dashed edge.
4. Reader node: resize works, scroll works inside the node.
5. Reader node: sidebar tabs (Notes/AI/Tags) work.
6. Article share: generate link → open in incognito → read-only article renders.
7. Board share: existing `/share/[shareId]` still works with website/note/chat nodes.
8. Reader node on shared board renders in read-only mode (after future task for hydration).

**Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve build issues from reader node integration"
```

---

## Task Dependency Order

```
Task 1 (types) ─────────────────────────┐
Task 2 (extract ReaderCore) ─────────────┤
                                         ├─── Task 3 (ReaderNode)
                                         │        │
                                         │        ├─── Task 4 (register in BoardCanvas)
                                         │        │        │
                                         │        │        └─── Task 5 (WebsiteNode update)
                                         │
Task 7 (article share service) ──────────┤
                                         ├─── Task 8 (article share API)
                                         │        │
                                         │        └─── Task 9 (article share page)
                                         │
Task 6 (boards-service reader sanitize) ─┘

Task 10 (reader share UI) ─── depends on Task 7 + Task 2
Task 11 (build + verify) ─── depends on all above
```

Parallelizable: Tasks 1+7 can run in parallel. Tasks 6 can run in parallel with 3-5. Tasks 8-9 can run in parallel with 3-5.
