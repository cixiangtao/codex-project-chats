# Contributing

Thanks for helping improve Codex Project Chats. Keep changes focused on project grouping, search, and navigation back to the official Codex view. Discuss larger changes in an issue before implementing them.

## Setup and checks

Use Node.js 24.18.0 (`.nvmrc`) and pnpm 12.15.0 (`packageManager`). From the repository root:

```sh
pnpm install --frozen-lockfile
pnpm run check
pnpm test
pnpm run package
```

With nvm, run `nvm install` and `nvm use` to select the development runtime. Corepack users can run `corepack pnpm` in place of `pnpm`. If your global pnpm is older, `npx --yes pnpm@12.15.0 <command>` runs the pinned version without changing the global installation. Build-script permissions and dependency overrides are declared in `pnpm-workspace.yaml`.

`pnpm run check` type-checks the extension, tests, and React Webview TypeScript/TSX. Vitest runs `.test.ts` files directly against the source, using a module mock for the VS Code API. Controller tests cover disposal and stale requests; jsdom tests use React `act` and exercise focus, tooltip content, IME search, collapse state, and visibility-aware time labels. DOM simulation does not verify browser layout or the real VS Code host. Use `pnpm run test:watch` for watch mode. The extension host compiles to CommonJS in `dist/extension/`. esbuild bundles the browser entry from `webview/src/main.ts` with production React and React DOM into `dist/webview/main.js`; its HTML and CSS are copied alongside it. `pnpm run build` cleans `dist/` first, so old output cannot leak into a package. esbuild transpiles and bundles; `pnpm run check` remains the type-checking gate.

Tests use generated local fixtures. They do not require a Codex login or read your real history. A POSIX executable fixture is skipped on Windows. CI builds and packages the extension but does not claim end-to-end compatibility with the official extension.

The source directories are `src/` for the extension host, `webview/src/` for the interface, and `media/` for icons. `webview/src/vscode.d.ts` declares the browser bridge, and the UI imports shared message/localization types from `src/` using type-only imports. Edit these source files, not generated `dist/` files.

Generate a sample-data interface preview with `pnpm run preview /tmp/codex-project-chats-preview.html`. Append `en` for English; the default is Simplified Chinese. The preview embeds the actual built browser bundle.

To try the extension in VS Code, install a locally built VSIX in a separate VS Code profile with the official Codex extension installed and signed in. Use sample conversations and a disposable workspace when checking UI behavior.

## Optional integration tests

`test/live.mjs` reads real local metadata only when `CODEX_LIVE_BINARY` is explicitly set. It prints aggregate counts, not titles, paths, IDs, or transcripts. Run it only when you intend to grant access to that host's conversation history. It is not part of CI.

`test/host.cjs` is an opt-in VS Code extension-host harness. It expects a separately prepared user-data directory at `PROJECT_CHATS_TEST_WORK/vscode-user`, a configured metadata fixture returning three current-project conversations, and an output directory at `PROJECT_CHATS_TEST_WORK`. Invoke it through VS Code's `--extensionTestsPath` with both this extension and the official extension available. Set `PROJECT_CHATS_TEST_THREAD` only to intentionally test a real local conversation route. The harness checks official logs and asserts that no conversation editor tab is created. Never use your normal profile or publish its logs. This harness is not a self-contained CI launcher. It retains `.cjs` because the VS Code test-host entry point loads its `run` export through CommonJS.

## Pull requests

- Explain the user-visible problem, the change, and the checks you ran.
- Keep behavior, refactoring, and unrelated formatting in separate changes.
- Preserve the existing official sidebar when opening conversations.
- Never include real transcripts, conversation IDs, personal paths, credentials, or account details in fixtures or screenshots.
- Update both README entry points when usage or compatibility changes. English is canonical; `README.zh-CN.md` is the maintained Chinese companion. The product interface follows the VS Code display language, with Simplified Chinese and English translations.
- Use Conventional Commit subjects, for example `fix(routing): 🐛 preserve the existing Codex view`.

## Release boundary

`package.json` owns the extension version. The app-server client receives that version from the installed extension manifest. release-it updates the manifest and generates `CHANGELOG.md` from Conventional Commits. pnpm's lockfile tracks dependencies, not the root extension version. `pnpm run release:check` validates the version files and release configuration.

Follow the [Marketplace release procedure](docs/releasing.md): run `pnpm run release:dry patch` to preview a release and `pnpm run release:prepare patch` on a clean branch to prepare it. Inspect the generated changelog, submit the changes through a PR, and upload the inspected VSIX manually after required CI passes. Record the version tag only after verifying the public Marketplace payload. release-it does not commit, tag, push, publish to npm, or create a GitHub Release.

An uploaded package awaiting Marketplace validation is not yet a public release. Repository documentation changes can remain ahead of the last store package until a separately approved version update.
