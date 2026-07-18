# Memory capture & search prototype

**Status:** Prototype (Symphony task `8948f1db-d4cf-45d6-8a6f-15ca9a934c82`)  
**Source:** SaaS ideas consolidation 2026-06-03 — browser/content memory cluster.

## Scope

Fixture-backed capture and search across web pages, blog articles, and PDF-like (blog→PDF) documents, plus a browser-memory import **mock** that reuses extension snapshot fixtures without Chrome permissions.

## Fixtures

| File | Role |
|------|------|
| `src/lib/__fixtures__/memory-captures.json` | Typed captures: `web_page`, `blog_article`, `pdf_document` with annotations |
| `src/lib/__fixtures__/browser-memory-snapshots.json` | Extension-shaped snapshots for `mockBrowserMemoryImport()` |

## Module

`src/lib/memory-capture.ts`

- `ingestMemoryCaptureFixtures()` — load typed fixture captures
- `mockBrowserMemoryImport()` — sanitize browser-memory snapshots (same contract as `POST /api/browser-memory/import`)
- `buildPrototypeCorpus()` — merge typed + mock imports (dedupe by URL)
- `searchMemoryCaptures(corpus, query)` — hits with snippet, source (kind/url/label), `capturedAt`, and `annotationContext`

## UI

`/memory` — local search UI over the fixture corpus (no auth).

## Verification

```bash
# Unit tests (smallest check)
pnpm test -- memory-capture

# Optional CLI proof (requires Node ESM import of TS — use test path if this fails locally)
pnpm memory:demo          # default query: queryable
pnpm memory:demo marginalia

# Type-check
pnpm type-check
```

Open http://127.0.0.1:3000/memory after `pnpm dev:app` to exercise the UI.

## Related production path

`POST /api/browser-memory/import` persists sanitized snapshots to Turso; this prototype stays in-memory/fixture-only and does not call paid APIs or migrations.

## Residual risk

- Search is in-memory over fixtures, not wired to Turso `searchArticles()` yet.
- `pnpm memory:demo` imports `.ts` directly; prefer `pnpm test -- memory-capture` in CI.
- Blog→PDF path stores extracted text only; no real PDF binary or R2 upload in this prototype.
