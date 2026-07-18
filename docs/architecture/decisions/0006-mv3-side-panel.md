# ADR-0006: Chrome MV3 Side Panel + hashed `rdr_*` API keys

**Date:** 2026-04-04 (extension scaffolded with side panel from the start)
**Status:** Current
**Supersedes:** [archive/decisions.md ADR-06](../../archive/decisions.md)

## Context

The Chrome extension needs a UI surface for chat and save actions. MV3 offers
popup (ephemeral, closes on blur) and side panel (persistent, stays open while
browsing). Extension requests originate from the extension's origin, not the
Worker's origin, so the same-origin session cookie cannot be shared.

## Decision

- **Side panel** (`sidePanel` permission, `side_panel.default_path`) as the
  primary UI for persistent chat sessions.
- **Popup** (`action.default_popup`) for ephemeral one-click actions
  (Save to Library / Import & Read).
- **Auth via hashed `rdr_*` API keys**, not session cookies. The `api_keys`
  table stores `token_hash` (SHA-256) + `prefix` + `revoked_at`; the plaintext
  is shown once at creation and never persisted. The extension sends the raw
  token as `Authorization: Bearer rdr_...`; `verifyApiKey()` hashes it for
  lookup. See `src/lib/api-keys.ts` and `src/worker/routes/keys.ts`.
- Content script runs `@mozilla/readability` in the page context on demand;
  both surfaces trigger it via Chrome messaging.
- Chrome Reading List sync (URLs, titles, read state) via the `readingList`
  permission.

## Rationale

- Side panel persists while the user navigates — essential for reading/chatting
  across page loads. Popup closes on blur, fine for one-click capture but not
  for extended chat.
- Hashed long-lived API keys avoid the complexities of OAuth token refresh
  from a service worker context (MV3 service workers are ephemeral).
- `rdr_` prefix lets `getAuthenticatedUserId()` distinguish an extension key
  from a BYOK provider key in the same `Authorization` header.

## Tradeoffs

- Side panel requires `sidePanel` permission (Chrome 114+); limits to
  Chromium-based browsers.
- Both surfaces share the same content script but have separate React app
  entry points (`popup/`, `side-panel/`).
- The extension is built independently in `packages/chrome-extension/` and is
  excluded from root Biome/ESLint tooling (see `biome.json` `!**/packages`).

## Alternatives considered

- **Popup-only:** simpler, but closes on blur — no persistent chat UX.
- **Full-page extension tab:** loses connection to the current browsing
  context.
- **Session cookie sharing:** not possible cross-origin in MV3.

## Distribution

Extension distribution is **deferred** until web import and capture flow are
reliable (see [product/overview.md](../../product/overview.md) scope). Local
install: `packages/chrome-extension/ → pnpm dev → load unpacked`. See
`packages/chrome-extension/README.md` and `PRIVACY.md`.
