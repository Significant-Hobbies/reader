# Chrome Extension: Chat with Any Webpage

**Date:** 2026-04-04
**Status:** Draft
**Goal:** Ship a Manifest V3 Chrome extension that lets users chat with any webpage via AI, save pages + conversations to their Web Annotator library, and semantically search across everything they've chatted about.

---

## Architecture Overview

The extension is a thin client that reuses Web Annotator's existing backend API routes. Content extraction happens client-side in the extension (same `@mozilla/readability` approach used by `src/app/api/snapshot/route.ts`). AI chat streams through the existing `POST /api/ai/chat` endpoint. Saving articles calls `POST /api/articles`. Auth reuses Firebase Auth with the same Google Sign-In flow from `src/components/AuthProvider.tsx`, storing the session cookie so subsequent API calls are authenticated.

```
Chrome Extension (Manifest V3)
  |
  |-- content-script.js     # Extracts page DOM, sends to side panel
  |-- side-panel.html/tsx   # React app: chat UI, save button, settings
  |-- background.js         # Service worker: auth state, message routing
  |
  |-- Calls Web Annotator API (same Vercel deployment) ---->
        /api/ai/chat         (existing, src/app/api/ai/chat/route.ts)
        /api/ai/summarize    (existing, src/app/api/ai/summarize/route.ts)
        /api/articles        (existing, src/app/api/articles/route.ts)
        /api/auth/session    (existing, src/app/api/auth/session/route.ts)
        /api/ext/chat        (NEW -- unauthenticated free-tier endpoint)
        /api/ext/vector      (NEW -- vector memory CRUD)
```

### Key Design Decisions

1. **Client-side extraction, not server-side snapshot** -- The extension has direct DOM access, so we run Readability in the content script instead of fetching the URL server-side like `snapshot/route.ts` does. This avoids CORS issues, works on pages behind auth walls, and handles SPAs that render client-side.

2. **Side panel, not popup** -- Manifest V3 side panels persist while navigating. A popup would close on every click outside it, killing the chat experience.

3. **Reuse existing API routes** -- The AI chat route (`src/app/api/ai/chat/route.ts`) already handles multi-provider streaming with BYOK. The articles route (`src/app/api/articles/route.ts`) already deduplicates by URL. No need to duplicate this logic.

4. **Free tier via a new lightweight endpoint** -- Unauthenticated users hit a rate-limited `/api/ext/chat` route that uses the server's `AI_GATEWAY_API_KEY` (same pattern as the `gateway` provider in `src/lib/ai-server.ts` line 66). Authenticated users call the standard `/api/ai/chat` with their own keys or the gateway.

5. **Vector memory as a separate concern** -- Embedding generation and search are additive. The core chat experience works without them. Vector endpoints get added in a later phase.

---

## Phase 1: Scaffold Extension + Dev Workflow

**Outcome:** Empty Manifest V3 extension with side panel, loads on any page, dev tooling configured.

### Structure

```
packages/chrome-extension/
  manifest.json              # Manifest V3
  src/
    background.ts            # Service worker
    content-script.ts        # DOM extraction
    side-panel/
      index.html
      App.tsx                # React root
      components/            # Chat, Settings, SaveButton
      lib/                   # api client, auth, extraction
    styles/
      globals.css            # Tailwind
  vite.config.ts             # Vite for building extension
  tailwind.config.ts
  tsconfig.json
  package.json
```

### Manifest V3 Config

- `permissions`: `activeTab`, `sidePanel`, `storage`, `identity`
- `side_panel.default_path`: `side-panel/index.html`
- `content_scripts`: match `<all_urls>`, inject `content-script.js`
- `background.service_worker`: `background.js`
- `host_permissions`: Web Annotator API origin (the Vercel deployment URL)
- CSP: restrict to `self` + the API origin

### Dev Workflow

- Vite builds the extension to `dist/` with watch mode
- Chrome loads `dist/` as unpacked extension
- `pnpm dev` in extension package starts Vite watch
- Monorepo: extension package sits alongside the Next.js app, shares types from `src/types.ts` via a workspace reference or a shared `packages/types` package

### Tasks

1. Create `packages/chrome-extension/` with `package.json`, `tsconfig.json`, `vite.config.ts` (use `@crxjs/vite-plugin` or `vite-plugin-chrome-extension` for HMR)
2. Write `manifest.json` with side panel, content script, background service worker
3. Scaffold empty React app in `side-panel/` with Tailwind
4. Add `content-script.ts` that sends a message with `document.documentElement.outerHTML` when the side panel requests it
5. Add `background.ts` that relays messages between content script and side panel
6. Verify: extension loads in Chrome, side panel opens, content script injects

---

## Phase 2: Page Content Extraction

**Outcome:** When the side panel opens, it extracts and displays the current page's title, byline, and readable content.

### Approach

Reuse the exact same extraction pipeline as `src/app/api/snapshot/route.ts` (lines 39-48):
- `@mozilla/readability` for article extraction
- But run it in the content script, not on the server, since we already have the DOM

The content script:
1. Clones `document` (to avoid mutating the page)
2. Runs `new Readability(clonedDoc).parse()`
3. Returns `{ title, content, byline, siteName, url: location.href }`

The side panel receives this via `chrome.runtime.sendMessage` and displays a header with the page title + byline. The full `content` HTML is held in memory for the AI system prompt (same approach as `buildSystemPrompt` in `src/components/NotesAIChat.tsx` lines 149-178).

### Edge Cases

- **Non-article pages** (dashboards, apps): Readability returns `null`. Fall back to `document.title` + `document.body.innerText.slice(0, 8000)` as the context.
- **SPAs that load lazily**: Content script waits for `document.readyState === 'complete'` + a short debounce before extracting.
- **PDF pages**: Detect by content type or `.pdf` URL. Show a "PDFs not supported in extension -- save to library instead" message. The main app already handles PDFs via `pdf-parse`.
- **Iframes/shadow DOM**: Readability only processes the main frame. Acceptable for v1.

### Tasks

1. Add `@mozilla/readability` and its types to the extension's dependencies
2. Implement extraction in `content-script.ts` with clone + parse + fallback
3. Wire side panel to request extraction on open and on tab navigation (`chrome.tabs.onUpdated`)
4. Display extracted page header (title, byline, URL) in the side panel
5. Strip HTML from content for the AI system prompt (reuse the `stripHTML` pattern from `NotesAIChat.tsx` line 143)

---

## Phase 3: AI Chat

**Outcome:** Users can ask questions about the current page and get streaming AI responses.

### Chat UI

Port the chat UI patterns from `src/components/NotesAIChat.tsx`:
- Message list with user/assistant bubbles (same styling: blue for user, gray-800 for assistant)
- Markdown rendering via `react-markdown` + `remark-gfm`
- Streaming cursor animation
- Stop button during generation
- Clear chat button
- Settings panel for provider/model/API key selection

### Streaming

Two paths based on auth state:

**Authenticated users** -- Call `POST /api/ai/chat` on the Web Annotator API. The request body matches the existing contract (see `src/app/api/ai/chat/route.ts` lines 32-38):
```
{ provider, model, apiKey, systemPrompt, messages }
```
The `__session` cookie is attached automatically since the extension has `host_permissions` for the API origin. Stream the response as plain text (same `streamProtocol: 'text'` used by `NotesAIChat.tsx` line 215).

**Unauthenticated users (free tier)** -- Call a new `POST /api/ext/chat` endpoint that:
- Does NOT require `getAuthenticatedUserId()`
- Rate-limits by IP (e.g., 10 chats/day via a Firestore counter or Vercel KV)
- Uses the server's `AI_GATEWAY_API_KEY` with `gateway` provider and a cheap model (`openai/gpt-4.1-mini`)
- Caps message history to 6 messages and content context to 2000 chars
- Returns the same plain text stream format

### System Prompt

Build the system prompt the same way as `buildSystemPrompt` in `NotesAIChat.tsx` (lines 149-178), but without notes context (no notes in the extension). Include:
- Page title, URL, byline
- First 4000 chars of stripped article text (same `slice(0, 4000)` as line 150)

### Quick Actions

Pre-built prompt buttons above the chat input:
- "Summarize this page"
- "Key takeaways"
- "ELI5"
- "Find claims that need citations"

These just inject the prompt text and call `sendMessage()`, same pattern as `queuedPrompt` in `NotesAIChat.tsx` (lines 496-507).

### AI Config Storage

Store provider/model/apiKey in `chrome.storage.local` (not `localStorage` like the web app does at `src/lib/ai-config.ts` line 74). Same `AIConfig` type, same `AI_CONFIG_STORAGE_KEY`.

### Tasks

1. Create `POST /api/ext/chat` route in `src/app/api/ext/chat/route.ts` with IP rate limiting
2. Build chat component in extension, adapting `NotesAIChat.tsx` patterns
3. Implement streaming fetch with abort controller
4. Add settings panel (provider selector, model selector, API key input) using same provider/model lists from `src/lib/ai-config.ts`
5. Add quick action buttons
6. Wire auth state to toggle between authenticated and free-tier endpoints
7. Persist chat messages per URL in `chrome.storage.local` (keyed by URL, max 20 conversations cached)

---

## Phase 4: Auth (Firebase in Extension)

**Outcome:** Users log in once with Google, extension stays authenticated for 14 days (matching the session cookie expiry in `src/lib/auth-server.ts` line 7).

### Flow

1. User clicks "Sign in" in the side panel
2. Extension opens `chrome.identity.launchWebAuthFlow` with Google OAuth (using the same Firebase project's OAuth client ID from `NEXT_PUBLIC_FIREBASE_API_KEY` / auth domain)
3. Receives the Google OAuth token
4. Calls Firebase Auth REST API to exchange for a Firebase ID token
5. Sends the ID token to `POST /api/auth/session` (same route at `src/app/api/auth/session/route.ts`), which sets the `__session` cookie
6. The cookie is now attached to all subsequent API calls to the Web Annotator origin

### Why Not Firebase JS SDK Directly

The Firebase JS SDK uses popups/redirects that don't work well in extension contexts. `chrome.identity.launchWebAuthFlow` is the standard Chrome extension pattern for OAuth. We convert the resulting credential to a Firebase ID token server-side.

### Auth State Persistence

- Store the user's email/name/photo in `chrome.storage.local` for displaying the avatar
- The actual auth is the `__session` HTTP-only cookie managed by the server
- On extension startup, make a lightweight `GET /api/auth/me` call (new endpoint) to check if the session is still valid
- If expired, show "Sign in" button again

### New API Endpoint

`GET /api/auth/me` -- returns `{ uid, email, displayName, photoURL }` if session is valid, 401 otherwise. Reuses `getAuthenticatedUserId()` from `src/lib/auth-api.ts`.

### Tasks

1. Create `GET /api/auth/me` route in `src/app/api/auth/me/route.ts`
2. Configure Google OAuth consent screen to allow the extension's origin
3. Implement `chrome.identity.launchWebAuthFlow` in `background.ts`
4. Exchange Google credential for Firebase ID token
5. Call `/api/auth/session` to set cookie
6. Build sign-in/sign-out UI in side panel
7. Show user avatar + email when authenticated
8. Check session validity on extension startup

---

## Phase 5: Save to Library

**Outcome:** One-click save of current page + chat history to the user's Web Annotator library.

### Save Flow

1. User clicks "Save to Library" in the side panel (only visible when authenticated)
2. Extension sends `POST /api/articles` with `{ url, title, byline, content }` -- exact same contract as `src/app/api/articles/route.ts` line 34
3. The route deduplicates by URL (line 41-43: `findArticleByUrl`), so saving the same page twice returns the existing article ID
4. If this is a new article, extension also sends `PATCH /api/articles/{id}` to attach the chat history as `aiChat` (same pattern as `persistMessagesToServer` in `NotesAIChat.tsx` lines 298-311)
5. Extension shows a success toast with a link to open the article in Web Annotator's reader view (`/reader/{id}`)

### Save Options

- **Tags**: Optional tag input before saving (reuses the tag autocomplete pattern from the web app)
- **List**: Optional list picker (calls `GET /api/lists` to fetch user's lists, then `PUT /api/articles/{id}/lists` to add)
- **Auto-save chat on close**: Optionally persist chat when the extension side panel closes, if the user has already saved this page

### Tasks

1. Build "Save to Library" button component with loading/success/error states
2. Wire to `POST /api/articles` with extracted content
3. Attach chat history via `PATCH /api/articles/{id}` after save
4. Add optional tags input and list picker
5. Show success toast with "Open in Web Annotator" link
6. Handle dedup case: show "Already in library -- update chat?" prompt

---

## Phase 6: Vector Memory (Semantic Search)

**Outcome:** All chatted pages are embedded and searchable via semantic similarity. "What was that article about X?" works across the entire library.

### Approach

Use the SaaS Maker SDK (`@saas-maker/sdk`, already installed at `src/lib/saasmaker.ts`) vector memory API. SaaS Maker provides vector storage and similarity search as part of its SDK.

### Embedding Pipeline

New server-side endpoint `POST /api/ext/vector/embed`:
1. Receives `{ articleId }` after an article is saved
2. Fetches the article content from Firestore
3. Chunks the content into ~500-token segments with overlap
4. Generates embeddings via the configured AI provider (OpenAI `text-embedding-3-small` or gateway equivalent)
5. Stores vectors in SaaS Maker's vector memory, keyed by `userId + articleId + chunkIndex`
6. Also embeds the chat messages (each message pair as a chunk) for conversational recall

### Search Endpoint

New `POST /api/ext/vector/search`:
1. Receives `{ query, userId }`
2. Embeds the query
3. Searches SaaS Maker vector memory for top-K similar chunks
4. Returns article IDs, titles, and relevant snippets
5. Replaces the current client-side keyword search (`src/lib/articles-service.ts` `searchArticles` function, lines 672-766) for extension users

### Extension UI

- Search bar at the top of the side panel: "Search across all your chatted pages..."
- Results show article title, URL, and the matching snippet
- Click a result to open it in Web Annotator or start a new chat on that page

### Embedding Triggers

- **On save**: Embed article content when user clicks "Save to Library"
- **Batch backfill**: One-time migration endpoint to embed all existing articles (background job)
- **On chat save**: Re-embed chat messages when conversation is persisted

### Tasks

1. Evaluate SaaS Maker SDK vector API capabilities and limits
2. Create `POST /api/ext/vector/embed` route with chunking + embedding logic
3. Create `POST /api/ext/vector/search` route
4. Add search UI to extension side panel
5. Trigger embedding on article save
6. Add batch backfill script in `scripts/`
7. Handle embedding failures gracefully (retry queue or skip with warning)

---

## Phase 7: Polish + Edge Cases

**Outcome:** Extension is production-ready, handles all edge cases, and provides a smooth UX.

### UX Polish

- **Page navigation detection**: Re-extract content when the user navigates to a new page within the same tab. Listen to `chrome.tabs.onUpdated` with `changeInfo.status === 'complete'` in the background script.
- **Chat per page**: Maintain separate chat histories per URL in `chrome.storage.local`. When the user navigates, load the cached chat for that URL (if any).
- **Keyboard shortcut**: `Cmd+Shift+A` (configurable) to toggle the side panel. Defined in `manifest.json` under `commands`.
- **Badge count**: Show unread count or "new" badge on the extension icon when AI finishes responding and the side panel is closed.
- **Dark/light mode**: Match the system preference. Extension side panel supports both themes (Tailwind `dark:` classes).
- **Offline handling**: Show "You're offline" banner. Cached chats remain accessible for reading.
- **Error states**: Network errors, rate limit errors, invalid API key errors -- all handled with the same `toUserFacingError` pattern from `NotesAIChat.tsx` (lines 50-106).
- **Loading skeleton**: Shimmer animation while extracting page content.

### Performance

- **Lazy-load Readability**: Only import `@mozilla/readability` when the side panel opens, not on every page load.
- **Content script minimal footprint**: The content script should be <5KB. Only inject the extraction logic, not React.
- **Chunk streamed responses**: Same streaming approach as the web app -- no buffering the entire response.

### Security

- API keys stored in `chrome.storage.local` (encrypted at rest by Chrome)
- Session cookie is HTTP-only, set by the server (not accessible to extension JS)
- Content script does not inject any UI into the host page
- Extension CSP restricts script sources to `self`
- No `externally_connectable` -- the extension does not expose message ports to web pages

### Tasks

1. Implement page navigation detection and chat switching
2. Add keyboard shortcut command
3. Add dark/light mode support
4. Add offline detection and cached chat access
5. Add loading skeletons and error boundaries
6. Performance audit: measure content script size, side panel TTI
7. Security review: CSP headers, storage encryption, no data leaks

---

## Phase 8: Distribution + Launch

**Outcome:** Published on Chrome Web Store, announced on Product Hunt.

### Chrome Web Store

1. Create developer account ($5 one-time fee)
2. Prepare store listing:
   - Title: "Web Annotator -- Chat with Any Page"
   - Description: Focus on "AI chat for any webpage" + "save to research library"
   - Screenshots: side panel on various sites (news article, documentation, blog)
   - Categories: Productivity, Developer Tools
3. Privacy policy: Document what data is collected (page content sent to AI provider, articles saved to Firestore with user consent)
4. Submit for review (typically 1-3 business days)

### Product Hunt Launch

- Tagline: "Chat with any webpage. Save the conversation."
- Maker comment explaining the flow: extract -> chat -> save -> search
- Demo video: 60-second screen recording showing the full flow
- Launch day: Tuesday or Wednesday (highest PH traffic)

### Landing Page

Add a `/extension` page to the Web Annotator site:
- Hero: "Chat with any webpage" + Chrome Web Store install button
- Demo GIF/video
- Feature grid: Extract, Chat, Save, Search
- Pricing: Free tier (10 chats/day) vs. Signed in (unlimited with your own API keys)
- Link to Chrome Web Store

### Tasks

1. Create Chrome Web Store developer account
2. Design store listing assets (icon 128x128, screenshots 1280x800, promo tile 440x280)
3. Write privacy policy
4. Build `/extension` landing page
5. Record demo video
6. Submit to Chrome Web Store
7. Prepare Product Hunt launch assets
8. Launch and monitor reviews/feedback

---

## New API Endpoints Summary

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/ext/chat` | POST | None (IP rate-limited) | Free-tier AI chat for unauthenticated users |
| `/api/auth/me` | GET | Session cookie | Check session validity, return user info |
| `/api/ext/vector/embed` | POST | Session cookie | Embed article + chat for vector search |
| `/api/ext/vector/search` | POST | Session cookie | Semantic search across user's library |

All other calls use existing endpoints without modification.

---

## Existing Code Reuse Map

| Extension Need | Existing Code | File |
|---|---|---|
| Page extraction | `Readability` + `parseHTML` | `src/app/api/snapshot/route.ts` (pattern, not the actual server call) |
| AI chat streaming | `streamText`, multi-provider, BYOK | `src/app/api/ai/chat/route.ts` |
| AI provider config | `AIProvider`, `FALLBACK_MODELS`, `PROVIDER_LABELS` | `src/lib/ai-config.ts` |
| Language model creation | `createLanguageModel`, `requiresApiKey` | `src/lib/ai-server.ts` |
| System prompt construction | `buildSystemPrompt`, `stripHTML` | `src/components/NotesAIChat.tsx` lines 143-178 |
| Chat UI patterns | Message bubbles, streaming cursor, settings panel | `src/components/NotesAIChat.tsx` |
| Article creation + dedup | `createArticleRecord`, `findArticleByUrl` | `src/lib/articles-service.ts` |
| Article sanitization | `sanitizeArticlePayload`, `sanitizeHTML` | `src/lib/articles-service.ts` |
| Auth session management | `createSessionCookie`, `verifySessionCookie` | `src/lib/auth-server.ts` |
| Auth user ID extraction | `getAuthenticatedUserId` | `src/lib/auth-api.ts` |
| Firebase client config | `firebaseConfig`, `auth`, `googleProvider` | `src/lib/firebase.ts` |
| SaaS Maker SDK | `SaaSMakerClient` instance | `src/lib/saasmaker.ts` |
| Types | `Article`, `AIChatMessage`, `AIConfig` | `src/types.ts`, `src/lib/ai-config.ts` |

---

## Risk Register

| Risk | Mitigation |
|---|---|
| Chrome Web Store review rejection | Follow Manifest V3 best practices, minimal permissions, clear privacy policy |
| Rate limiting abuse on free tier | IP-based rate limit + CAPTCHA fallback. Monitor via SaaS Maker analytics |
| Readability fails on SPAs | Fallback to `body.innerText`. Accept degraded experience on non-article pages |
| Session cookie not sent from extension | Ensure `host_permissions` includes exact API origin. Test cross-origin cookie behavior |
| Vector embedding costs | Use cheapest embedding model (`text-embedding-3-small`). Only embed on explicit save, not on every chat |
| Content script conflicts with host page | Content script injects zero DOM. Communication is purely via `chrome.runtime.sendMessage` |
| Firebase Auth in extension context | Use `chrome.identity.launchWebAuthFlow` instead of Firebase JS SDK popups |

---

## Out of Scope (v1)

- Firefox/Safari/Edge extensions (Chrome-only for v1)
- Highlighting/annotating directly on the host page (that's a v2 content script overlay feature)
- PDF extraction in extension (use the main app for PDFs)
- Offline AI (all inference is server-side or via provider APIs)
- Team/collaboration features
- Extension-to-extension sync (all state goes through the Web Annotator API)
