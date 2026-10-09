# Reader extension privacy

The extension reads the active tab’s URL and title when its popup opens. It sends them to the Reader account only when the user clicks Save link.

The connection key is stored in Chrome’s local extension storage. Reader stores the key hash, not its plaintext. Disconnect clears the local key; revoke it in Reader’s Connections page to invalidate it on the server.

The extension does not inject content scripts, scan browsing history, extract page content, run AI requests, or send extension telemetry.
