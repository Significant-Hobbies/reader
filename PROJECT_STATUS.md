# Project Status

Last updated: 2026-06-04

## Current Scope

Reader is a web annotator and reading memory app for capturing articles, PDFs, tags, highlights, summaries, key points, reading progress, projects, and AI-assisted chat over saved material.

## Done

- Core reading features are documented: article/PDF capture, annotation, tags, search, projects, progress, summaries, key points, chat history, and customizable reading views.
- Cloudflare Workers deployment through OpenNext is documented.
- Turso/Drizzle, better-auth Google, R2 PDF storage, and free-ai/BYOK/local AI integrations are part of the current architecture.
- The memory capture prototype exists at `/memory` with fixture-backed web, blog, PDF-like, and browser-memory import examples.
- The production browser-memory import path persists sanitized snapshots through `POST /api/browser-memory/import`.
- Critical and high audit findings have been addressed; residual audit notes are documented.

## Planned Next

1. Turn the memory capture prototype into an authenticated, persisted product flow.
2. Move prototype search from in-memory behavior to Turso-backed search where it matters for real usage.
3. Clarify PDF storage behavior so extracted text, source files, and R2 objects are consistently represented.
4. Add abuse and rate-limit handling only where real endpoints need it.

## Deferred / Parked

- Browser-extension distribution is deferred until the web import and capture flow are reliable.
- Full personal knowledge-base automation is parked behind strong capture, retrieval, and trust primitives.
- Paid team/library workflows are deferred.
