# Product Overview

Reader stores links you choose to save. Add a URL in the web app or click Save link in the Chrome extension. ChatGPT handles reading and discussion through MCP.

The app has an inbox and a Connections page. Links have a title, URL, creation date, and read/unread state. Search matches titles and URLs. Opening or fetching a link does not silently mark it read.

The MCP tools find links, retrieve available text, and update read state when the user asks. Source text can be unavailable because a site blocks extraction or is not a web document; the original URL remains available.

## Boundaries

No RSS, built-in AI, annotations, reader view, PDF capture, boards, lists, or memories. The Chrome extension is a URL/title capture popup, with no background page scanning or native Reading List sync.

Existing account data remains in D1 and R2. Legacy web articles appear as links; their stored text remains retrievable. Local browser data is not deleted. No schema migration is required for the simplification.

## Access

Google sign-in identifies the app account. Extension keys are created in Connections and stored hashed on the server. MCP uses Google-backed Auth0 OAuth and maps to the existing account’s Google subject.

See [architecture](../architecture/overview.md) for connection setup and [project status](../../PROJECT_STATUS.md) for the deployment boundary.
