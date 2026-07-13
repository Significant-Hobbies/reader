## 1. Data Model and Parsing

- [x] 1.1 Add `rss_feeds` and `rss_entries` Drizzle tables, relations/indices, inferred types, and an additive SQL migration.
- [x] 1.2 Implement pure OPML parsing and RSS/Atom normalization helpers with payload and item limits.
- [x] 1.3 Add fixture-driven unit tests covering nested OPML, RSS 2.0, Atom, malformed XML, and stable deduplication IDs.

## 2. Persistence and API

- [x] 2.1 Implement user-scoped feed and entry database operations for upsert, list/filter, read state, delete cascade, and saved-article linkage.
- [x] 2.2 Implement safe bounded feed fetching and refresh-one/refresh-all orchestration with per-feed results.
- [x] 2.3 Add authenticated `/api/rss` routes for subscriptions, OPML import, refresh, entries, read state, and save-to-library.
- [x] 2.4 Add route/database unit tests for ownership, idempotency, validation, partial refresh failures, and save-to-library behavior where practical.

## 3. RSS Inbox UI

- [x] 3.1 Add the `/rss` route and a navigation entry from the authenticated app shell.
- [x] 3.2 Build the RSS inbox page with subscription filter, unread/all controls, counts, chronological entry cards, and empty/error/loading states.
- [x] 3.3 Add OPML file import, manual refresh, remove-subscription, read/unread, open-original, and save-to-library interactions with React Query cache updates.
- [x] 3.4 Verify responsive and keyboard-accessible behavior for the inbox's primary actions.

## 4. Verification and Handoff

- [x] 4.1 Run targeted parser/database tests, full Vitest, typecheck, Biome check, and production build; fix in-scope failures.
- [x] 4.2 Validate the OpenSpec change, archive it, and update `PROJECT_STATUS.md` with the shipped RSS reader and migration/deploy note.
