# Project Status

Last updated: 2026-06-20

## Current Scope

Reader is a web annotator and reading memory app for capturing articles, PDFs, tags, highlights, summaries, key points, reading progress, projects, and AI-assisted chat over saved material.

## Done

- Core reading features: article/PDF capture, annotation, tags, search, projects, progress, summaries, key points, chat history, and customizable reading views.
- **De-OpenNext migration (wave 2):** Vite + React 19 SPA with React Router; Hono worker at `src/worker.ts` serving `/api/*` and `dist` assets binding (`not_found_handling = single-page-application`). Worker name/origin preserved (`reader`).
- Turso/Drizzle, better-auth Google, R2 PDF storage (`PDFS_BUCKET`), and free-ai/BYOK/local AI integrations.
- Memory capture prototype at `/memory` with fixture-backed examples and `POST /api/browser-memory/import`.
- Critical and high audit findings addressed; residual audit notes documented.

## Planned Next

1. Turn the memory capture prototype into an authenticated, persisted product flow.
2. Move prototype search from in-memory behavior to Turso-backed search where it matters for real usage.
3. Clarify PDF storage behavior so extracted text, source files, and R2 objects are consistently represented.
4. Add abuse and rate-limit handling only where real endpoints need it.

## Deferred / Parked

- Browser-extension distribution is deferred until the web import and capture flow are reliable.
- Full personal knowledge-base automation is parked behind strong capture, retrieval, and trust primitives.
- Paid team/library workflows are deferred.
- `landing-astro` overlay not applicable (no landing-astro submodule in reader).
