# Reader — project status

## Product scope

Saved links, read/unread state, an add-link form, a one-click Chrome capture extension, and ChatGPT MCP access. Nothing else is in the active product.

## Source implementation

- One account inbox: unread/read/all, title/URL search, pagination, and URL capture.
- Extension popup saves only the active tab’s URL and title. No content script, chat, side panel, or Reading List sync.
- Three MCP tools: `search`, `fetch`, and `set_read`.
- Account isolation and separate OAuth read/write permissions.
- Existing web captures retain their content. No schema migration or saved-data deletion.
- Reader, PDF, annotation, board, RSS, memory, and built-in AI modules removed from the active source.

## Release boundary

The simplification was merged in PR #78 and deployed on 2026-10-09. Merged-main CI and the production deployment passed. The live inbox, MCP discovery, and authenticated retrieval through the existing ChatGPT app were verified.
Chrome extension v0.2.0 is published as a GitHub release. The direct **Reader Links** plugin is connected in ChatGPT using a dedicated public OAuth client with PKCE and explicit `reader.read` / `reader.write` grants. Live ChatGPT search, fetch, mark-read, and restore-unread checks passed; both state changes were independently observed in the Reader inbox. The test item was restored to its original unread state.

## Operational constraints

The Worker remains named `reader`. Deployment and migrations require explicit owner approval. Legacy D1 tables and R2 data remain intact.
