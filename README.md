# Reader

A saved-link inbox for use with ChatGPT.

- Paste a URL in the app or save the current tab with the Chrome extension.
- Search links and keep a simple read/unread state.
- Connect ChatGPT through MCP to find links, retrieve available text, and mark items read or unread.

Vite + React, a Hono Cloudflare Worker, D1, and Google sign-in. No built-in AI, article reader, PDF uploads, boards, annotations, memories, or RSS.

## Development

```sh
pnpm install
pnpm dev
pnpm quality
pnpm cf:build
pnpm test:e2e
```

The extension is built with `pnpm --filter web-annotator-extension build` and loaded from `packages/chrome-extension/dist` as an unpacked Chrome extension. Create a key in Reader’s Connections page, paste it into the popup once, then click Save link.

## MCP

The stateless Streamable HTTP endpoint is `/api/mcp`. Its three tools are `search`, `fetch`, and `set_read`. Fetching never marks an item read. Unavailable source text is reported explicitly.

Google-backed Auth0 OAuth maps the connection to the same Reader account. Reads require `reader.read`; read-state changes require `reader.write`. Existing extension keys remain valid. See [the architecture and connection setup](docs/architecture/overview.md).

## Existing data and rollout

The database schema and saved data remain unchanged. Legacy web articles appear as links and their captured content remains available through MCP. Local browser data and stored PDFs are not deleted.

This simplification requires a manual deployment and OAuth configuration before it can be used in ChatGPT. Source verification is separate from deployment and an authenticated ChatGPT end-to-end check.

[Documentation](docs/index.md) · [Current status](PROJECT_STATUS.md)
