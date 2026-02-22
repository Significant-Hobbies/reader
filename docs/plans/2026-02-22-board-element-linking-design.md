# Board Element Linking Design

## Problem

The board currently lacks the ability to reference specific HTML elements from parsed websites. Users cannot select elements when chatting with AI, and notes/chats are disconnected from the article content. Browser zoom also interferes with the canvas zoom.

## Features

### 1. Disable Browser Zoom on /board

Extend `useSuppressBrowserZoom()` to cover all zoom vectors:

- Gesture events (`gesturestart`/`gesturechange`) for Safari trackpad pinch
- Dynamic viewport meta tag (`maximum-scale=1, user-scalable=no`) on mount, removed on unmount
- `touch-action: manipulation` on board wrapper

### 2. Element Picker Side Panel

A right-side overlay panel (`ElementPickerPanel`) that shows parsed article HTML from a website node.

Trigger: "Browse content" button on `WebsiteNode` (visible only when `articleId` exists).

Behavior:

- Fetches article content via existing `/api/articles/[id]` endpoint
- Renders parsed HTML with hoverable annotatable elements (same `ANNOTATABLE_SELECTOR` as Reader)
- Clicking an element shows a floating action menu: "Add Note" / "Ask AI"
- Panel is dismissible, overlays the canvas from the right

### 3. Element Anchoring on Board Nodes

New data model addition:

```typescript
interface ElementAnchor {
  articleId: string;
  websiteNodeId: string;
  elementIndex: number;
  tagName?: string;
  textPreview?: string;
}
```

Extended types:

- `NoteNodeData` gains optional `elementAnchor`
- `AIChatNodeData` gains optional `elementAnchor`
- `AIChatMessage` gains optional `elementAnchor`

### 4. Link Display: Chip + Edge

- Inline chip in note/chat node showing `[tagName] "preview..."`, clickable to reopen picker
- Auto-generated dashed edge from note/chat node to parent website node
- Edge label with element tag + short preview

### 5. Shared Storage (Board <-> Reader)

Both views read/write the same `article.notes[]` and `article.aiChat[]`:

- Board note nodes with `elementAnchor` write to `article.notes[]` using the existing `NoteAnchor` format
- Board AI chats linked to an article write to `article.aiChat[]`
- Reader displays the same data natively
- Last-write-wins conflict strategy (single-user app, debounced saves)

### 6. Selection Action Menu

On element click in the picker panel:

- "Add Note": creates a NoteNode on the canvas near the website node, linked to the element, writes to `article.notes[]`
- "Ask AI": creates/focuses an AIChatNode, injects element text as context, writes to `article.aiChat[]`

## Data Flow

```
WebsiteNode "Browse content"
    -> ElementPickerPanel (overlay, right side)
    -> Fetch article content
    -> Render annotatable HTML
    -> User clicks element
    -> Action menu: "Add Note" / "Ask AI"
    -> Creates board node with ElementAnchor
    -> Auto-save syncs to article.notes[] / article.aiChat[]
    -> Reader sees the same notes/chats
```

## Non-Goals

- Selection from iframe nodes (cross-origin restrictions)
- Real-time collaboration / multi-user conflict resolution
- Drag-and-drop element reordering in picker panel
