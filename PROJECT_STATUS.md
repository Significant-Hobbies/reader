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

The simplification is a source candidate. Production has not been deployed by this change.
OAuth provider setup and an authenticated ChatGPT retrieval/write-back check remain required for live acceptance. Do not describe the connector as working in production without that evidence.

## Operational constraints

The Worker remains named `reader`. Deployment and migrations require explicit owner approval. Legacy D1 tables and R2 data remain intact.
