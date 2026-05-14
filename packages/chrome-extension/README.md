# Web Annotator — Chrome Extension

Companion extension for [Web Annotator](https://reader.sarthakagrawal927.workers.dev). Opens the current tab in Web Annotator's reader/annotator view and exposes a side-panel for page-level chat.

## What it does

- **Toolbar button**: opens a popup that lets you send the active tab to Web Annotator (article extraction + annotation).
- **Side panel**: a persistent reader/chat surface for the page you're on.
- **Content script**: a thin script that runs on every page (read-only — no network, no DOM rewrites). It exists so the side panel can pull the page's clean reading text using `@mozilla/readability` on demand.

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Lets the popup capture the current tab's URL and title when you click "Open in Web Annotator". |
| `scripting` | Required by the side panel to execute the Readability extraction in the page context on demand. |
| `sidePanel` | Enables the side-panel UI. |
| `storage` | Caches the most recent extraction + chat scratch state so you don't lose them on tab switch. |

Host permission `https://reader.sarthakagrawal927.workers.dev/*` is the only remote endpoint the extension talks to (your Web Annotator instance).

## Develop locally

```bash
cd packages/chrome-extension
pnpm install
pnpm dev          # vite build --watch into ./dist
```

Then in Chrome: `chrome://extensions` → enable Developer mode → **Load unpacked** → select `packages/chrome-extension/dist`.

## Build a release artifact

```bash
pnpm build        # one-shot production build into ./dist
pnpm pack:zip     # zips dist/ into web-annotator-extension-<version>.zip
```

Upload the resulting `.zip` to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole). Bump `version` in `manifest.json` for each release (must increase monotonically).

## Type-check + tests

```bash
pnpm type-check
pnpm test
```

## Files

```
manifest.json              MV3 manifest
src/background.ts          Service worker (side-panel wiring)
src/content-script.ts      In-page Readability extraction
popup/                     Toolbar popup UI (React + Vite)
side-panel/                Side-panel UI (React + Vite)
icons/                     16/48/128 px PNG icons
```

## Privacy

The extension does not collect, transmit, or share any personal data on its own. It only sends a URL/title (and, on user action, extracted reading text) to your configured Web Annotator backend. See [PRIVACY.md](./PRIVACY.md).
