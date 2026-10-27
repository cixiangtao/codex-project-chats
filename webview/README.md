# Webview development

This is the browser half of the VS Code extension. It shares the root package manifest,
pnpm lockfile, and toolchain; it is not a separate package.

```text
webview/
  dev/                         Synthetic bridge, fixtures, and preview theme
  index.html                   Vite development preview
  src/
    main.ts                    Production browser entry and stylesheet imports
    app/                       App composition, mounting, host HTML template, integration tests
    components/
      header/                  ScopeSwitcher, SearchInput, Toolbar, header styles
      status/                  Empty/error/pagination feedback and styles
    features/conversations/    List, group, row, tooltip, interaction hooks, time formatting
    hooks/                     Shared browser hooks (visibility-aware clock)
    host/                      Typed VS Code bridge and message lifecycle
    i18n/                      Localization context and host catalog reader
    styles/                    Global theme, reset, focus, and scrollbar rules
    vscode.d.ts                Declaration for acquireVsCodeApi
```

Keep components in separate named files. Put behavior and styles next to the feature that
owns them; move a hook to `hooks/` when it has no conversation-specific responsibilities.
Use direct imports so dependencies remain visible. Components export components; hooks,
contexts, mounting, and parsing live in separate modules to preserve Fast Refresh boundaries.

The host owns conversation data, search, scope, and pagination. The interface owns expansion
preferences, transient hover/focus behavior, and relative time labels. Restore persisted
preferences defensively because stored data can outlive an extension version.

Import shared host contracts with `import type`. Browser code cannot import Node/VS Code
APIs or host runtime modules; Oxlint enforces these boundaries. Tests may import pure host
helpers and Node fixture utilities. The bridge is acquired once when mounting and passed
explicitly to React; UI components never call `acquireVsCodeApi` themselves.

Oxfmt enables import sorting, package field and script sorting, and Tailwind class sorting.
Side-effect imports retain their evaluation order, including the mock bridge and stylesheet entries.
The interface currently uses theme-based CSS rather than Tailwind utilities.

Run these commands from the repository root:

```sh
pnpm dev                 # Sample preview; ?lang=en selects English
pnpm run check          # TypeScript checks for both runtimes and tests
pnpm run lint           # TypeScript, Hooks, Fast Refresh, import boundaries
pnpm run lint:fix       # Fix supported lint issues
pnpm run format         # Format Webview, package manifest, and frontend configs
pnpm run format:check   # CI formatting gate
pnpm test               # Host tests and colocated Webview tests
pnpm run build          # Host output and production Vite assets
```

Vitest discovers `*.test.ts` and `*.test.tsx` under `src/`. UI integration tests use jsdom
and React `act`; pure time-formatting tests run in Node. Tests do not read real history.
Check browser layout separately because jsdom does not perform layout. The dev preview
uses synthetic metadata and a mock bridge; installed extensions always use packaged assets.

CSS uses VS Code theme variables. Keep feature styles together and preserve compact rows,
keyboard focus, IME composition, and the tooltip's left-side pointer lane when changing UI.
Vite extracts the imported CSS into local production assets permitted by the Webview CSP.
