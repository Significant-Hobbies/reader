# Testing

`pnpm quality` is the complete source gate. It includes TypeScript, lint, coverage, dependency/code-health checks, documentation checks, the combined app/landing build, and extension checks/build.

Unit tests exercise real in-memory SQLite storage for account isolation, duplicate saves, literal title/URL searches, pagination, preserved legacy content, and read/unread state. They do not use the owner’s databases or apply migrations.

MCP route tests verify protocol initialization, the three-tool catalog, retrieval without read-state changes, explicit boolean writes, missing credentials, write scopes, hostile Origins, missing items, and unavailable source content. Signed JWT fixtures verify read-only tokens cannot write.

Source extraction tests cover SSRF rejection, bounded response streams, supported content types, and extraction failure.

Run `pnpm cf:build` and then `pnpm test:e2e` to check the built inbox and landing at phone, tablet, and desktop widths. Synthetic API responses cover URL capture, search, read/unread transitions, and the guest sign-in boundary. Screenshots stay in the ignored `.fleet-local/screenshots/` directory.

The extension has a separate test runner. API tests verify its retained key slot, authenticated URL/title capture, and rejection when no connection exists.

Local browser and synthetic OAuth tests do not establish that production is deployed or that ChatGPT has completed a live OAuth connection. The acceptance check for that is described in [architecture](../architecture/overview.md).
