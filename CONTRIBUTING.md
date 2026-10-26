# Contributing

Thanks for helping improve Codex Project Chats. Keep changes focused on project grouping, search, and navigation back to the official Codex view. Discuss larger changes in an issue before implementing them.

## Setup and checks

Use Node.js 22 and npm. From the repository root:

```sh
npm ci
npm run check
npm test
npm run package
```

Tests use generated local fixtures. They do not require a Codex login or read your real history. A POSIX executable fixture is skipped on Windows. CI builds and packages the extension but does not claim end-to-end compatibility with the official extension.

To try the extension in VS Code, install a locally built VSIX in a separate VS Code profile with the official Codex extension installed and signed in. Use sample conversations and a disposable workspace when checking UI behavior.

## Optional integration tests

`test/live.cjs` reads real local metadata only when `CODEX_LIVE_BINARY` is explicitly set. It prints aggregate counts, not titles, paths, IDs, or transcripts. Run it only when you intend to grant access to that host's conversation history. It is not part of CI.

`test/host.cjs` is an opt-in VS Code extension-host harness. It expects a separately prepared user-data directory at `PROJECT_CHATS_TEST_WORK/vscode-user`, a configured metadata fixture returning three current-project conversations, and an output directory at `PROJECT_CHATS_TEST_WORK`. Invoke it through VS Code's `--extensionTestsPath` with both this extension and the official extension available. Set `PROJECT_CHATS_TEST_THREAD` only to intentionally test a real local conversation route. The harness checks official logs and asserts that no conversation editor tab is created. Never use your normal profile or publish its logs. This harness is not a self-contained CI launcher.

## Pull requests

- Explain the user-visible problem, the change, and the checks you ran.
- Keep behavior, refactoring, and unrelated formatting in separate changes.
- Preserve the existing official sidebar when opening conversations.
- Never include real transcripts, conversation IDs, personal paths, credentials, or account details in fixtures or screenshots.
- Update both README entry points when usage or compatibility changes. English is canonical; `README.zh-CN.md` is the maintained Chinese companion. The product interface is Chinese independently of documentation language.
- Use Conventional Commit subjects, for example `fix(routing): 🐛 preserve the existing Codex view`.

## Release boundary

`package.json` owns the extension version. Keep the lockfile's root version, the app-server client version in `src/client.ts`, and the changelog consistent when changing a version. Inspect the VSIX before distribution.

A dedicated [Marketplace release workflow](docs/releasing.md) maintains version PRs and publishes only their approved merge commits. It is disabled until a repository-scoped GitHub App and Microsoft Entra federation are configured. It creates a Git tag only after verifying the matching public Marketplace payload; it never creates a GitHub Release or npm package. Ordinary feature/dependency merges may update the version PR but must not publish an extension.

Read the setup, activation, dry-run, and recovery procedure before enabling the workflow. An uploaded package awaiting Marketplace validation is not a public release. Repository documentation changes can remain ahead of the last store package until a separately approved version update.
