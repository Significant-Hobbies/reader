## Context

Reader is a client-rendered React SPA backed by authenticated Hono routes and Turso. Articles already provide the destination for content a user wants to keep, but there is no persistent source or inbox model. The supplied OPML contains a mix of RSS and Atom feeds, so interoperability and idempotent refreshes matter from the first import.

The Worker runtime must fetch untrusted, user-supplied feed URLs. Existing URL-validation and safe-fetch patterns establish the security boundary; feed fetching must retain those protections and bound response work.

## Goals / Non-Goals

**Goals:**

- Deliver an authenticated, personal RSS inbox that works with standard RSS 2.0 and Atom feeds.
- Make OPML import and repeated refreshes idempotent.
- Keep feed-reading state separate from intentionally saved library articles.
- Reuse the existing Worker, Turso, React Query, and UI patterns.
- Provide useful per-feed error and refresh state instead of failing the entire inbox.

**Non-Goals:**

- Scheduled/background refresh, push notifications, podcast playback, full-text feed scraping, folders, sharing, or feed discovery.
- Anonymous/local-only RSS state.
- Automatically importing every feed item into the article library.
- Deploying, applying the production migration, or importing the sample OPML into production.

## Decisions

### Store subscriptions and entries in dedicated tables

Add `rss_feeds` and `rss_entries`. Feeds are unique by `(user_id, feed_url)`. Entries reference a feed and are unique by `(feed_id, external_id)`, where `external_id` is the feed GUID/id or a deterministic fallback based on the entry URL and publication data. Read state and saved article ID live on the entry.

This avoids overloading `articles` with transient inbox items. Treating all entries as articles would make refresh noisy, inflate search results, and blur the user's explicit save intent.

### Parse feeds in the Worker without a new dependency

Use `DOMParser` from the existing `linkedom` dependency and small normalization helpers for RSS and Atom variants. Normalize title, link, author, excerpt/content, published timestamp, and external ID. Sanitize any HTML before returning or persisting it.

A dedicated feed library would cover more edge cases but introduces a production dependency and bundle cost. The first version needs the common RSS/Atom formats represented by the sample, with fixture tests protecting normalization.

### Refresh on demand with bounded concurrency

`POST /api/rss/refresh` refreshes all subscriptions or a selected feed. Fetch several feeds concurrently with a small worker pool and return a result per feed. Each fetch uses the existing SSRF-safe fetch path, a timeout, redirect validation, a response-size limit, and an entry cap. One bad feed does not abort successful feeds.

Scheduled refresh is deferred because it requires Worker trigger/config changes and introduces operational behavior beyond the requested in-app reader. Manual refresh is predictable and sufficient for the personal-use MVP.

### Keep OPML parsing server-side

The client uploads OPML text to `POST /api/rss/import`. The Worker validates payload size, recursively reads outlines with `xmlUrl`, accepts only HTTP(S) URLs after SSRF validation, and upserts owned subscriptions. This centralizes validation and allows future clients to reuse the endpoint.

### Save entries through a dedicated RSS action

`POST /api/rss/entries/:id/save` verifies entry ownership and creates an article record from the normalized feed content when useful; when content is absent, it creates a link record. It records the resulting article ID and is idempotent. This keeps the UI to one action and avoids trusting client-supplied entry data.

### Use one dense inbox page

`/rss` has a compact feed sidebar/filter, unread/all toggle, refresh/import controls, and chronological entry list. Opening an entry marks it read and opens the canonical URL in a new tab; saving is a separate action. The nav exposes RSS alongside the existing library surface.

## Risks / Trade-offs

- **Untrusted feed URLs can target internal services** → Reuse SSRF validation for initial URLs and redirects; reject non-HTTP(S), private, loopback, and metadata destinations.
- **Large or malformed XML can consume Worker resources** → Cap OPML/feed payload size, cap entries per feed, use fetch timeouts, and return explicit validation errors.
- **Feed formats vary widely** → Support common RSS 2.0 and Atom patterns with fixtures from representative shapes; preserve per-feed errors for unsupported feeds.
- **Manual refresh can be slow across 33 feeds** → Bound concurrent requests, stream no intermediate state, show a page-level progress state, and return partial success details.
- **Feed-provided HTML is unsafe** → Sanitize before persistence/display and render excerpts as text in the inbox.
- **Database migration is required before routes can work** → Keep migration additive and reversible by dropping the two new tables; do not apply it to production in this task.

## Migration Plan

1. Add the two tables to Drizzle schema and a forward-only additive SQL migration.
2. Ship backend parsing, persistence, and routes.
3. Ship the SPA route and navigation.
4. Apply the migration before deploying application code in production.
5. Import the sample OPML from the UI after deployment if desired.

Rollback application code first, then drop RSS tables only if the stored subscription/read-state data is intentionally disposable.

## Open Questions

- Background refresh cadence and Cloudflare scheduled triggers remain deferred until manual use demonstrates the need.
- Folder preservation from nested OPML outlines remains deferred; the first version imports every feed into a flat subscription list.
