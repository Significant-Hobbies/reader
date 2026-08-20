# ADR-0008: RSS/Atom Inbox (manual refresh, no scheduled triggers)

**Date:** 2026-07-13
**Status:** Current
**Planning record:** migrated to [GitHub Issues](https://github.com/Significant-Hobbies/reader/issues); this ADR preserves the shipped decision.

## Context

Reader could save individual articles and PDFs but could not follow publishing
sources or surface new posts. A focused RSS inbox turns the existing library
into a repeatable reading workflow.

## Decision

Add an authenticated RSS/Atom inbox scoped per user:

- **Two dedicated tables** (`rss_feeds`, `rss_entries`) — see
  `src/lib/db/schema.ts`. Feeds unique by `(user_id, feed_url)`; entries unique
  by `(feed_id, external_id)` where `external_id` is the feed GUID/id or a
  deterministic fallback. Read state and saved article ID live on the entry.
  This keeps transient inbox items out of `articles` (treating all entries as
  articles would inflate search and blur explicit save intent).
- **Parse feeds in the Worker without a new dependency:** `DOMParser` from the
  existing `linkedom` dep + small RSS/Atom normalisation helpers
  (`src/lib/rss-parser.ts`). Sanitise any HTML before persisting/returning.
- **Manual refresh only:** `POST /api/rss/refresh` refreshes all subscriptions
  or a selected feed with bounded concurrency (4), a 15 s per-feed timeout,
  response-size cap, entry cap, and per-feed error isolation. One bad feed
  does not abort the others. `ETag` / `Last-Modified` are honoured.
- **OPML import server-side:** `POST /api/rss/import` validates payload size,
  recursively reads outlines with `xmlUrl`, accepts only HTTP(S) URLs after
  SSRF validation, upserts owned subscriptions, reports
  imported/existing/rejected counts.
- **Save entry to library:** `POST /api/rss/entries/:id/save` is idempotent —
  creates an article record when content is available, otherwise a link-type
  article, and links the entry to it.
- **One dense inbox page:** `/rss` with feed sidebar/filter, unread/all
  toggle, refresh/import controls, chronological entry list. Opening an entry
  marks it read and opens the canonical URL in a new tab.

## Rationale

- Dedicated tables avoid overloading `articles` with transient inbox items.
- Reusing `linkedom` avoids a new feed-parser dependency and bundle cost.
- Manual refresh is predictable and sufficient for personal use; scheduled
  refresh would require Worker trigger/config changes and operational
  behaviour beyond the requested MVP.
- Server-side OPML parsing centralises validation and is reusable by future
  clients.

## Tradeoffs

- Manual refresh across many feeds can be slow; mitigated by bounded
  concurrency and a page-level progress state with partial success details.
- Feed formats vary widely; common RSS 2.0 and Atom patterns are supported
  with fixture tests. Unsupported feeds return a per-feed error.
- Untrusted feed URLs can target internal services → reuse SSRF validation
  for initial URLs and redirects; reject non-HTTP(S), private, loopback, and
  metadata destinations.

## Migration note

The additive `drizzle/0002_first_green_goblin.sql` migration must be applied
before deployment. See
[operations/runbooks/migrate-schema.md](../../operations/runbooks/migrate-schema.md).

## Open questions / deferred

- Background refresh cadence and Cloudflare scheduled triggers remain deferred
  until manual use demonstrates the need.
- Folder preservation from nested OPML outlines remains deferred; the first
  version imports every feed into a flat subscription list.
