# Reader Node + Article Sharing

## Problem

Articles on the board are represented as small website cards (title + excerpt). Users want the full reader experience inside the board — scrollable article content, inline note markers, text selection, AI chat — as a single canvas entity. Additionally, articles should be shareable via public links (same pattern as boards).

## Decisions

- **Approach A: Reader Node** — a new ReactFlow node type that embeds the full reader. Chosen over slide-over panel (breaks canvas metaphor) and expandable website card (messy dual-mode component).
- Website card stays as the lightweight reference. "Open in Board" spawns an adjacent reader node.
- Article sharing reuses the proven board sharing pattern (random shareId token, public route, no auth).

## Design

### 1. Reader Node Type

New node type `reader` on the board canvas. Large, resizable (default ~700x500, min 400x300). Contains:

- Scrollable article HTML (via existing `ReaderView`)
- Inline note markers (DOM portals on annotatable elements)
- Text selection menu: "Add note" / "Ask AI"
- Collapsible sidebar with Notes / AI Chat / Tags tabs
- AI summary section

**Persisted data (in board document):**

```typescript
interface ReaderNodeData {
  articleId: string;
  url: string;
  title: string;
}
```

**Runtime data** (content, notes, aiChat, aiSummary, keyPoints) fetched from `/api/articles/:id` at render time via `useQuery`. Not stored in the board document.

### 2. Shared Reader Core

Extract reusable logic from `ReaderClient.tsx` (~1100 lines) into `ReaderCore.tsx`:

- Article content rendering
- Annotatable element indexing
- Inline note markers (DOM portals)
- Text selection action menu
- Note CRUD
- AI summary display
- Sidebar tabs (Notes / AI Chat / Tags)

**Props:**

```typescript
interface ReaderCoreProps {
  article: Article;
  readOnly?: boolean;
  onArticleUpdate?: (updates: Partial<Article>) => void;
  onSpawnNote?: (anchor: ElementAnchor, text: string) => void;
  onSpawnAIChat?: (anchor: ElementAnchor, text: string) => void;
}
```

Standalone `ReaderClient` becomes a thin wrapper (fetch + layout + `<ReaderCore />`).
`ReaderNode` also wraps `<ReaderCore />` inside a ReactFlow node.

### 3. Board Integration

**Spawning:** Website node "Open in Board" action creates a reader node at `websiteNode.position + (width + 60, 0)` with a solid edge connecting them.

**Note/chat spawning from reader:** Text selection "Add note" / "Ask AI" calls `onSpawnNote` / `onSpawnAIChat` callbacks injected by `BoardCanvasClient`. Creates note/chat nodes positioned relative to the reader node, connected by dashed edges.

**Article sync:** `useBoardArticleSync` already handles syncing note/chat nodes (with `elementAnchor.articleId`) back to article documents. Reader node's `useQuery` refetches when the article is updated, keeping inline markers in sync.

**ElementPickerPanel deprecation:** Reader node replaces ElementPickerPanel's functionality. "Browse content" on website nodes becomes "Open in Board".

### 4. Article Sharing

Same pattern as board sharing:

- `shareId?: string` field on Article documents in Firestore
- `generateArticleShareId(articleId, userId)` / `revokeArticleShareId(articleId, userId)` in articles-service
- `fetchArticleByShareId(shareId)` — strips `userId`, `id`, `aiChat`
- `GET /api/share/article/[shareId]` — public endpoint
- `/share/article/[shareId]/page.tsx` — renders `<ReaderCore article={article} readOnly />`

Shared articles show: content, notes (read-only), AI summary, key points. No AI chat, no editing.

### 5. Shared Boards with Reader Nodes

Public shared boards need reader node content without auth. `fetchBoardByShareId` hydrates reader nodes server-side:

- For each reader node, fetch the article content from Firestore directly (server-side, no auth needed since it's an internal call)
- Include `content`, `notes` (stripped of internal IDs), `aiSummary`, `keyPoints` in the reader node data
- Exclude `aiChat`, `userId`, article `id`

Reader nodes on shared boards render in read-only mode — content visible, no selection menu, no editing.

### 6. Read-Only Behavior

Reader node with `readOnly`:

- Article content renders normally (scrollable)
- No text selection action menu
- No note editing / creation
- No AI chat input
- Sidebar shows existing notes and AI summary in view-only mode
- Inline note markers visible but not interactive

## File Changes

| File                                           | Action                                                                       |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/types.ts`                                 | Add `ReaderNodeData`, `reader` to BoardNode type union, `shareId` to Article |
| `src/components/reader/ReaderCore.tsx`         | Create — extracted shared reader logic                                       |
| `src/components/ReaderClient.tsx`              | Refactor — thin wrapper around ReaderCore                                    |
| `src/components/board/nodes/ReaderNode.tsx`    | Create — new node type                                                       |
| `src/components/board/BoardCanvasClient.tsx`   | Register reader type, inject callbacks, handle spawning                      |
| `src/components/board/nodes/WebsiteNode.tsx`   | Replace "Browse content" with "Open in Board"                                |
| `src/lib/boards-service.ts`                    | Sanitize reader nodes, hydrate for shared boards                             |
| `src/lib/articles-service.ts`                  | Add article share functions                                                  |
| `src/app/api/articles/[id]/route.ts`           | Add shareAction handling                                                     |
| `src/app/api/share/article/[shareId]/route.ts` | Create — public article endpoint                                             |
| `src/app/share/article/[shareId]/page.tsx`     | Create — public article page                                                 |
| `src/app/share/article/[shareId]/layout.tsx`   | Create — minimal layout                                                      |

## Verification

1. Board: click website node "Open in Board" -> reader node spawns with full article content
2. Reader node: select text -> "Add note" -> note node appears on canvas, connected by dashed edge
3. Reader node: inline note markers appear and update when notes are added
4. Reader node: sidebar tabs work (Notes / AI Chat / Tags)
5. Resize reader node -> content reflows
6. Share article: generate link -> open in incognito -> read-only article renders
7. Share board with reader nodes -> reader content visible in read-only mode
8. `pnpm build` passes
