# Product Overview

## What

Reader is a personal research library: capture web articles and PDFs, read them
in a distraction-free reader, annotate with notes and highlights, organise with
tags/lists/boards, search across everything, and AI-chat or auto-summarise the
saved material. A companion Chrome MV3 extension captures pages from the
browser and syncs with Chrome's native Reading List.

## Who

- **End users:** individual readers saving articles and PDFs. Sign-in is Google
  OAuth via better-auth; data is per-user isolated at the database level.
- **Operators:** the maintainer running Turso schema migrations and Cloudflare
  Workers deploys. Currently single-user in production.

## Where

- Production app: `https://read.significanthobbies.com` (Cloudflare Worker
  `reader`, custom domain). See [surfaces.md](surfaces.md) for the full list.
- Source: this repository.
- Landing page: built from `landing-astro/` and overlaid onto `dist/index.html`
  during `cf:build`; the SPA lives at `dist/app.html` and is served at `/app`.

## Scope

**In scope:** article/PDF capture, rich annotations, tags/lists/boards,
full-text search, AI chat and summaries, RSS/Atom inbox with OPML import,
memory capture, Turso persistence, R2 PDF storage, free-ai gateway + BYOK +
local-ai dev bridge.

**Out of scope (deliberate):**

- Browser-extension distribution (deferred until web import/capture is
  reliable).
- Full personal knowledge-base automation behind strong capture, retrieval, and
  trust primitives.
- Paid team/library workflows.
- `landing-astro` as a separate deployable product — it is an overlay only.
- RSS background refresh / scheduled triggers / notifications / feed discovery
  (current RSS refresh is manual).
- Rate limiting on AI/snapshot/proxy endpoints (deferred until endpoint-specific
  evidence; see [operations/env.md](../operations/env.md) and the residual
  audit notes in [archive/security-audit-2026-03-29.md](../archive/security-audit-2026-03-29.md)).

## Operating posture

Personal-use support (closure decision 2026-07-10): keep Reader available for
direct use. No roadmap expansion; accept only maintenance, reliability, or
personally requested workflow fixes. See [STATUS.md](../../STATUS.md) for the
current objective and active work.

## Branding note

The product is named **Reader** and served at
`read.significanthobbies.com`. The package name and Chrome extension still use
the legacy `web-annotator` / "Web Annotator" string in places; the canonical
product name in new docs is **Reader**.
