# Archive

Historical records preserved verbatim (with a dated historical marker where
needed). These describe decisions, lessons, plans, and audits that were
authoritative at a point in time. Current truth lives in the rest of `docs/`.

When archiving a superseded doc, move it here with `git mv`, give it a dated
filename, and prepend a one-line historical marker pointing at the current
canonical doc.

## Pre-Vite architecture (Next.js + OpenNext era)

- [`decisions.md`](decisions.md) — ADRs authored while Reader ran on Next.js +
  OpenNext. ADR-01 (Next.js + OpenNext) is superseded by
  [../architecture/decisions/0001-vite-spa-hono-worker.md](../architecture/decisions/0001-vite-spa-hono-worker.md);
  ADR-02 through ADR-07 largely still apply but reference the old runtime.
- [`lessons.md`](lessons.md) — Engineering lessons captured pre-Vite. Many
  describe code that no longer exists (`scripts/patch-opennext.mjs`,
  `next.config.ts`, `WeakRef` patches, `serverExternalPackages`). Current
  lessons live in [../knowledge/learnings.md](../knowledge/learnings.md).
- [`learning-pre-vite-external-references.md`](learning-pre-vite-external-references.md)
  — External references curated pre-Vite. Current references live in
  [../knowledge/external-references.md](../knowledge/external-references.md).
- [`learning-pre-vite-new-things.md`](learning-pre-vite-new-things.md) —
  "New things to learn" notes from the pre-Vite era.

## Migration history

- [`plans-migrate-off-firebase.md`](plans-migrate-off-firebase.md) — Firebase
  → Turso + Auth.js + Vercel Blob migration plan (DONE). The actual cutover
  chose better-auth over Auth.js and R2 over Vercel Blob.
- [`retro-firebase-to-cloudflare-2026-04-25.md`](retro-firebase-to-cloudflare-2026-04-25.md)
  — Retro for the full infra swap (DB, Auth, Storage, Deployment).
- [`plans-browser-memory-import.md`](plans-browser-memory-import.md) —
  Browser-memory import plan (DONE; became `/api/browser-memory/import`).
- [`plans-memory-capture-prototype.md`](plans-memory-capture-prototype.md) —
  Memory capture prototype plan (DONE; promoted to persisted/authenticated).
- [`plans-chrome-extension-chat-with-page-2026-04-24.md`](plans-chrome-extension-chat-with-page-2026-04-24.md)
  — Chrome extension chat-with-page plan (archived).

## Audits / context

- [`security-audit-2026-03-29.md`](security-audit-2026-03-29.md) — Security
  audit from the Next.js + Firebase era. Many findings were fixed during the
  migration; residual items (CORS, rate limiting) are tracked in
  [../knowledge/failed-approaches.md](../knowledge/failed-approaches.md) and
  STATUS.md.
- [`project-recommendation-context-2026-06-06.md`](project-recommendation-context-2026-06-06.md)
  — CodeVetter Repo Unpacked-style audit for Starboard recommendations.
  References the pre-Vite `src/app/...` path layout; preserved for context.

## Marketing

Marketing copy iterations live in [`../marketing/`](../marketing/) (current,
not archived).
