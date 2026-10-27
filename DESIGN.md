# Sidebar design and architecture

The UI uses a native VS Code Webview View, not a separate website.

- A current/all-project control and title search stay visible at the top.
- Exact working directories define groups. Identical folder names include paths; narrow layouts retain path suffixes and expose full paths on hover.
- The current project expands initially. Other projects collapse initially. Search temporarily expands matching groups without overwriting the saved collapse state.
- Conversation rows use a compact single line (32px minimum height), with an ellipsized title on the left and a short last-update time aligned right. Repeated conversation icons are omitted to preserve title width; hovering reveals the full title, path, and exact timestamp. Selecting a row shows a short opening status and reveals the existing official Codex view, respecting its placement and avoiding editor tabs.
- Colors, fonts, focus, selection, and scrolling use VS Code theme variables. No remote fonts or images are loaded by the webview.
- Conversation hover details use a compact theme-aware tooltip (up to 280px wide and 180px tall), with a full title and inline labels for last-update time and project path. It aligns to the right with a 12px inset and reserves at least 64px on the left for moving the pointer between rows. It prefers placement above the row, falls back below when needed, and scrolls within the available space without covering its anchor. Titles retain their complete text in the model; list ellipsis is presentational. Long content wraps within the viewport; keyboard focus also reveals details, Escape dismisses them, and scrolling or refreshing closes stale details.
- VS Code contribution labels use native package.nls resources. Extension and webview copy share a typed bilingual catalog selected from the VS Code display language: Chinese locales use Simplified Chinese, all other locales fall back to English. Conversation content, paths and upstream diagnostics remain unchanged.
- Busy and opening changes update existing row nodes. Result changes restore focus by conversation ID without taking focus from search or scope controls. Relative time labels update once per minute while the document is visible, pause while hidden, and catch up on return.
- Loading, missing workspace, empty history, unmatched search, interface failure, and pagination have explicit states.
- Pagination reads 50 records at a time. Counts represent loaded conversations.

## Ownership

`src/client.ts` owns one stdio app-server child process and JSONL request lifecycle. `src/model.ts` validates metadata, normalizes paths, and groups results. `src/extension.ts` owns the VS Code view, workspace scope, pagination, and stale-request handling. `src/routing.ts` targets the current window through the official URI handler. `src/protocol.ts` defines and validates the host-facing messages and types the outbound state. The presentation layer lives in `webview/src/`: `main.ts` mounts the view, `view.ts` renders it, `tooltip.ts` owns hover details, and `time.ts` formats update times. The modules use TypeScript and native DOM APIs. esbuild bundles them into `dist/webview/main.js`, with HTML and CSS alongside it. The extension host compiles separately to CommonJS in `dist/extension/`. Only generated Webview files are exposed through `localResourceRoots`; `media/` contains icons. Shared host types are imported with `import type` and do not bring Node or VS Code APIs into the browser bundle.

The webview receives only minimized metadata and constructs conversation text using DOM text content. A CSP limits scripts and resources. Opening a conversation requires an ID already present in the loaded list. Closing the view cancels its pending debounce, removes its listeners, invalidates outstanding results, and disposes only the app-server process created by this extension. A closed or not-yet-ready view cannot start a background list request.
