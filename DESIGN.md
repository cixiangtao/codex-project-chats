# Sidebar design and architecture

The UI uses a native VS Code Webview View, not a separate website.

- A current/all-project control and title search stay visible at the top.
- Exact working directories define groups. Identical folder names include paths; narrow layouts retain path suffixes and expose full paths on hover.
- The current project expands initially. Other projects collapse initially. Search temporarily expands matching groups without overwriting the saved collapse state.
- Conversation rows show a title and last-update time. Selecting a row reveals the existing official Codex view, respecting its placement and avoiding editor tabs.
- Colors, fonts, focus, selection, and scrolling use VS Code theme variables. No remote fonts or images are loaded by the webview.
- Loading, missing workspace, empty history, unmatched search, interface failure, and pagination have explicit states.
- Pagination reads 50 records at a time. Counts represent loaded conversations.

## Ownership

`src/client.ts` owns one stdio app-server child process and JSONL request lifecycle. `src/model.ts` validates metadata, normalizes paths, and groups results. `src/extension.ts` owns the VS Code view, workspace scope, pagination, and stale-request handling. `src/routing.ts` targets the current window through the official URI handler. `media/` contains the presentation layer.

The webview receives only minimized metadata and constructs conversation text using DOM text content. A CSP limits scripts and resources. Opening a conversation requires an ID already present in the loaded list. Closing the view disposes only the app-server process created by this extension.
