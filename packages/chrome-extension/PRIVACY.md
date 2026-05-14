# Privacy Policy — Web Annotator Extension

_Last updated: 2026-05-14._

The Web Annotator Chrome extension is built to be transparent: it talks to one backend (your Web Annotator instance) and stores a minimum of state locally.

## What the extension reads

- **Active tab URL and title** — read only when you explicitly click "Open in Web Annotator" or open the side panel for the current page.
- **Page reading text** — when you ask the side panel to summarize/chat, the extension runs `@mozilla/readability` inside the page and reads the cleaned article body.
- **Local extension storage** — recent extraction text and chat scratch state, scoped to the extension. Cleared on uninstall.

## What it sends, and where

The extension communicates with one server:

- `https://reader.sarthakagrawal927.workers.dev` — the Web Annotator backend.

When you take an action that requires server processing (save an article, ask a chat question), the extension sends the URL, title, and (when applicable) the extracted page text to that endpoint. Nothing is sent on pages where you take no action.

## What it does not do

- It does not run analytics, tracking, or fingerprinting scripts.
- It does not read form input, passwords, cookies, or browsing history.
- It does not share data with third parties.
- It does not modify pages you visit beyond mounting the content script for on-demand extraction.

## Account data

If you sign in to Web Annotator from the side panel, the auth flow is performed by the backend at the URL above. The extension itself does not store credentials.

## Contact

Issues or questions: open an issue at the project's GitHub repository.
