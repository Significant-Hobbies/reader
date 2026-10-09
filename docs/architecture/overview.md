# Architecture

Reader is a Vite/React SPA backed by a Hono Worker and Cloudflare D1. The Astro landing is overlaid into the same build. Google sign-in uses better-auth. Existing database tables and R2 data are retained unchanged.

## Active paths

- `src/components/HomeClient.tsx`: the link inbox and URL form.
- `src/components/ExtensionConnectClient.tsx`: extension keys and MCP connection information.
- `src/lib/links-db.ts`: account-scoped capture, search, pagination, retrieval, and read states over the existing `articles` table.
- `src/lib/link-content.ts`: bounded source-text extraction with URL and redirect validation.
- `src/worker/routes/articles.ts`: `/api/links`; `/api/articles` is a compatibility alias for capture clients.
- `src/worker/routes/mcp.ts`: stateless JSON-RPC over Streamable HTTP at `/api/mcp`.
- `packages/chrome-extension/src/popup`: explicit current-tab capture. No background worker or content script.

New links store URLs and titles. Existing web articles retain captured text. `in_progress` in legacy storage maps to `unread`; `read` remains `read`. New IDs are a deterministic hash of account and normalized URL to deduplicate concurrent captures without a migration. Fragments are removed; query parameters remain intact.

MCP reads do not change read state. The `set_read` tool requires a boolean and a write-authorized credential. Every storage operation is account-scoped. MCP source content is data, never instructions.

## ChatGPT connection setup

The source endpoint is `https://read.significanthobbies.com/api/mcp`. Live use requires an approved deployment and provider configuration; adding an endpoint to the code does not provision OAuth.

Use the existing Google-backed Auth0 integration:

1. Use an Auth0 resource/API identifier matching the Worker's configured `AUTH0_MCP_AUDIENCE`. The existing production identifier is `https://mcp.significanthobbies.com/reader/mcp`; set the ChatGPT advanced OAuth Resource field to that identifier while keeping the Server URL at the direct endpoint. For a fresh installation, use the direct endpoint as the API identifier. `AUTH0_ISSUER` must be the exact issuer with a trailing slash.
2. Define and grant `reader.read` and `reader.write`. Tokens must use RS256, the exact issuer and audience, the stable `google-oauth2|<subject>` identity, and a lifetime of at most one hour.
3. Configure an OAuth authorization-code client with PKCE S256 for ChatGPT. Use the exact redirect URI shown by ChatGPT’s connection-management page; do not guess it. Ensure the provider honors the OAuth resource parameter in the access-token audience and advertises S256 in discovery.
4. Add a custom MCP connection in ChatGPT with OAuth and this server URL. The verified production setup uses a dedicated third-party Native/public Auth0 application, User-Defined OAuth Client registration in ChatGPT, its public client ID, and token endpoint auth method `none`. No shared secret is needed. Grant only the Reader read/write scopes for user-delegated access; leave machine-to-machine and anonymous access denied. Auth0 CIMD preview succeeded but registration rejected ChatGPT's metadata, so it is not the working setup.
5. Sign in to Reader first with the same Google account. Then verify listing unread links, fetching a saved item, marking it read, and observing the updated inbox.

The linking challenge points to `/api/mcp/.well-known/oauth-protected-resource`, keeping discovery inside the existing Worker-first API routing. A standard alias also exists at `/.well-known/oauth-protected-resource/api/mcp`. The tools declare their OAuth scopes and return linking challenges. Read-only tokens never gain write access. The older `/reader/mcp` audience and `/api/mcp/reading` projections remain compatible with the existing external bridge; adapting that bridge’s tool catalog is separate from this repository.

Official references: [ChatGPT custom MCP connections](https://developers.openai.com/api/docs/guides/custom-mcp-server), [OAuth requirements](https://developers.openai.com/plugins/build/auth), [Streamable HTTP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).

## Rollout

No database migration or saved-data removal is needed. Worker name, production bindings, and secrets remain unchanged. Deploy and provider/account changes require owner approval. Test an authenticated ChatGPT connection after deployment before calling the live workflow complete.
