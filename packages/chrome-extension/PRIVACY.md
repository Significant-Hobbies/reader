# Privacy Policy — Web Annotator Extension

_Last updated: 2026-07-03._

The Web Annotator Chrome extension is built to be transparent: it talks to one backend (your Web Annotator instance) and stores a minimum of state locally.

## What the extension reads

- **Active tab URL and title** — read only when you explicitly click "Open in Web Annotator" or open the side panel for the current page.
- **Chrome Reading List entries** — URL, title, and read/unread state are read so native Chrome Reading List items can sync with Web Annotator.
- **Page reading text** — when you ask the side panel to summarize/chat, the extension runs `@mozilla/readability` inside the page and reads the cleaned article body.
- **Local extension storage** — recent extraction text, chat scratch state, Reader API key, and Reading List sync provenance, scoped to the extension. Cleared on uninstall.

## What it sends, and where

The extension communicates with one server:

- `https://read.significanthobbies.com` — the Web Annotator backend.

When you take an action that requires server processing (save an article, ask a chat question), the extension sends the URL, title, and (when applicable) the extracted page text to that endpoint. After you connect Reader, Chrome Reading List URLs, titles, and read/unread state are also sent to that endpoint for sync.

## What it does not do

- It does not run analytics, tracking, or fingerprinting scripts.
- It does not read form input, passwords, cookies, or browsing history.
- It does not share data with third parties.
- It does not modify pages you visit beyond mounting the content script for on-demand extraction.

## Account data

If you connect Web Annotator from the extension, the extension stores the `rdr_` API key locally in Chrome extension storage. It does not store your Google OAuth credentials.

## Contact

Issues or questions: open an issue at the project's GitHub repository.
