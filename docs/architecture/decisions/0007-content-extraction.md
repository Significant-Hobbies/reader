# ADR-0007: Content Extraction Stack

**Date:** 2026-02-13 (`linkedom` adopted replacing Playwright); pdfjs added 2026-02-14
**Status:** Current
**Supersedes:** [archive/decisions.md ADR-07](../../archive/decisions.md)

## Context

Articles are captured server-side from a URL; PDFs are uploaded and must be
viewable with text extraction. The extraction stack must run inside the
Cloudflare Workers runtime (no full browser process).

## Decision

- **HTML extraction (server):** `@mozilla/readability` + `linkedom` in the
  `/api/snapshot` flow. `linkedom` is a pure-JS DOM parser that replaced
  Playwright (too heavy/slow for Workers). HTML is sanitised before storage
  and re-sanitised on read.
- **PDF viewing (client):** `pdfjs-dist` + `react-pdf`. The pdfjs `workerSrc` is
  configured in `src/components/PDFViewer.tsx` via
  `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`, so Vite
  bundles the worker locally into `dist/assets/` — it is never fetched from a
  CDN. (`PDFReaderClient.tsx` renders the viewer UI around `PDFViewer`.)
- **PDF text extraction:** the `articles.extracted_text` column exists, but text
  is supplied by the client in the article payload (e.g. the Chrome extension's
  in-browser extraction). There is no server-side `pdf-parse` extraction at
  upload; the upload route only stores the binary in R2. TBD: whether the webapp
  populates `extracted_text` for direct PDF uploads.

## Rationale

- Readability is the reference implementation of the Mercury/Readability
  algorithm; produces clean article content.
- `linkedom` is lighter than JSDOM and Workers-compatible; Playwright requires
  a full browser process which is not viable in the Workers runtime.
- `pdfjs-dist` is the canonical PDF renderer for web; no viable pure-JS
  alternative.
- The pdfjs web worker is loaded locally (not from CDN) to satisfy the
  extension's strict CSP (`script-src 'self'`) and to avoid sandboxed CF
  Workers blocking remote script fetches.

## Tradeoffs

- `linkedom` is less complete than JSDOM for edge-case DOM APIs; acceptable
  for article extraction where Readability handles the parsing.
- Server-side PDF text extraction is not performed at upload; `extracted_text`
  depends on client-supplied text, so direct webapp PDF uploads may lack it.
  PDF metadata (page count, file size, storage path) is stored in
  `articles.pdf_metadata`.

## Alternatives considered

- **Playwright / Puppeteer:** requires a full browser process; not viable in
  Workers runtime; was used briefly before `linkedom`.
- **JSDOM:** heavier than `linkedom`; more node-specific APIs.
- **External PDF API (PDF.co etc.):** adds cost and an external dependency.

## Security notes

- All server-side URL fetches (snapshot, proxy, RSS refresh) funnel through
  `validateExternalUrl()` + `fetchWithValidatedRedirects()` — see
  [../data-flow.md](../data-flow.md).
- HTML is sanitised at ingestion and re-sanitised on read for
  defence-in-depth (carried forward from the security audit; see
  [archive/security-audit-2026-03-29.md](../../archive/security-audit-2026-03-29.md)).
