## Why

Reader can save individual articles and PDFs, but it cannot follow publishing sources or surface new posts. Adding a focused RSS inbox turns the existing library into a repeatable reading workflow, and the supplied OPML file provides an immediate set of real subscriptions to import.

## What Changes

- Add authenticated RSS subscription and feed-entry persistence scoped per user.
- Add OPML import that accepts standard RSS/Atom outlines, preserves feed titles and site URLs, and avoids duplicate subscriptions.
- Add on-demand refresh that fetches subscribed feeds, parses RSS 2.0 and Atom, and upserts entries without duplicating previously seen posts.
- Add an RSS inbox page with feed filtering, unread/read state, refresh feedback, and subscription management.
- Allow an RSS entry to be saved into the existing article library using Reader's current article capture flow.
- Seed no global data and perform no production migration or deploy as part of this change; the supplied OPML remains user-imported data.

## Capabilities

### New Capabilities

- `rss-subscriptions`: Manage a user's feeds and import subscriptions from OPML.
- `rss-refresh`: Safely fetch RSS/Atom feeds and persist normalized, deduplicated entries.
- `rss-inbox`: Browse feed entries, filter by subscription/read state, mark entries read or unread, and save entries to the article library.

### Modified Capabilities

- None.

## Impact

- Adds Drizzle tables and a SQL migration for RSS feeds and entries.
- Adds an authenticated `/api/rss` Worker route and server-side feed/OPML parsing utilities.
- Adds a `/rss` SPA route, navigation entry, and React Query-backed RSS UI.
- Reuses the existing article and snapshot endpoints when saving a feed entry; no new runtime dependency, scheduled trigger, external service, or environment variable is required.
