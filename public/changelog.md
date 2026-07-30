# Reader changelog

Meaningful improvements to saving, reading, annotating, and revisiting research.

## 2026-07-13 — RSS and Atom reading joined the library

- Authenticated readers can import OPML, manage feeds, refresh them, and track
  unread items.
- Feed items can be saved into the article and PDF library for annotation and
  later research.

## 2026-07-03 — Memory capture became durable

- Saved research memories gained authenticated persistence, search, and a
  dedicated reading surface.
- Existing browser memories can be imported into the account-backed
  collection.

## 2026-07-02 — Safer failure recovery

- Unhandled API and Worker failures now return controlled responses.
- A React error boundary provides a recovery path when a page cannot render.

## 2026-06-20 — Reader moved to a faster app shell

- Reader moved to Vite and React with a focused Hono Worker while preserving
  its production identity.
- Articles, PDFs, highlights, notes, boards, lists, search, and AI-assisted
  reading stayed together in one library.

[Roadmap](https://github.com/Significant-Hobbies/reader/issues) ·
[Source](https://github.com/Significant-Hobbies/reader)
