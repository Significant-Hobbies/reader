# Reader Chrome extension

A popup that saves the current tab’s URL and title to Reader. It does not scan pages, extract article content, run AI chat, open a side panel, or sync Chrome’s Reading List.

```sh
pnpm build
pnpm type-check
pnpm test
```

Load `dist/` as an unpacked extension in Chrome. In Reader, open Connections, create an extension key, and paste it into the popup. Click Save link on a web page. Existing installations keep the same `api-key` local-storage slot.

The extension needs only `activeTab`, `storage`, and access to the Reader origin. Public Chrome Web Store distribution is not part of this change.
