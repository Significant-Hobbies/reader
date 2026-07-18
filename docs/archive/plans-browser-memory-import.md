# Browser memory import — extension-captured page snapshot

**Status:** Prototype (Symphony task `28e4c7a7-bf0e-4306-8ae8-fb97256eb219`)  
**Source:** [saas-ideas consolidation](https://github.com/sarthakagrawal927/saas-ideas) at `aba1a83`, routed to Reader via Fleet triage.

## Chosen import path

**Extension-captured page snapshot** — the Chrome MV3 extension already extracts readable content via `@mozilla/readability` in the content script (`packages/chrome-extension/src/content-script.ts`) and saves single pages through `POST /api/articles`. This prototype adds a **batch import** API that accepts the same snapshot shape so offline queues or future “import browsing session” flows can land many pages at once without re-fetching live URLs.

Deferred paths (document only):

- **Browser-history export** — Chrome `History` / `Bookmarks` JSON; metadata-only rows would import as `type: link` until a fetch job runs.
- **Manual URL batch** — newline-separated URLs; overlaps with home “Save link” and board Add Source.

## Data contract

Only page metadata and extracted readable content are stored:

| Field | Required | Notes |
|-------|----------|-------|
| `url` | yes | `http:` / `https:` only; sensitive query params stripped |
| `title` | no | Falls back to URL |
| `content` | yes* | Sanitized HTML from Readability (*skipped if empty) |
| `byline`, `siteName`, `textContent` | no | `textContent` is not persisted (search uses `content`) |
| `visitedAt` | no | ISO timestamp for display only; not stored in v1 |

**Rejected at import:** `cookies`, `headers`, `localStorage`, `sessionStorage`, `credentials`, `authorization`, raw `Set-Cookie`, and any unknown top-level keys. URLs with non-http(s) schemes are dropped.

Imported articles are tagged `browser-memory` and deduplicated per user by URL (existing row is skipped, id returned in `skipped`).

## Search and AI

Imported rows use `type: article` with sanitized `content`, so they participate in:

- `GET /api/search?q=…` → `searchArticles()` (title, content, notes, aiChat)
- Reader AI chat over article body (same as manual imports)

No schema migration in v1.

## API

```
POST /api/browser-memory/import
Authorization: session cookie or Bearer rdr_* (extension)

{
  "snapshots": [ { "url", "title", "content", "byline?", "siteName?" } ],
  "listIds": ["optional-list-id"],
  "category": "optional"
}

→ { "imported": 2, "skipped": 1, "failed": 0, "ids": ["…", "…"] }
```

## Verification

- Fixture: `src/lib/__fixtures__/browser-memory-snapshots.json`
- Unit tests: `src/lib/__tests__/browser-memory-import.test.ts`
- Smoke: `pnpm test -- browser-memory-import` and `pnpm type-check`

## Remaining risk

- Batch import does not re-validate URLs against SSRF rules (`validateExternalUrl`); snapshots are trusted client-side captures. A follow-up should run URL validation if server-side re-fetch is added.
- `visitedAt` and `siteName` are not persisted yet.
- History-export and manual-batch paths need separate tasks.
