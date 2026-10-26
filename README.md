# Codex Project Chats

English · [简体中文](README.zh-CN.md)

Browse Codex conversations by project, then continue in the official Codex sidebar.

A small VS Code extension for developers who work across several repositories. It groups existing conversations by their working directory (`cwd`), without patching the official extension or implementing another chat client.

> **Preview:** end-to-end verified on macOS Apple Silicon. Other platforms are not yet verified end to end. The extension interface is currently in Simplified Chinese. This is an independent project, not an OpenAI product.

## Install and use

1. Install and sign in to the official [Codex extension](https://marketplace.visualstudio.com/items?itemName=openai.chatgpt).
2. Find **Codex Project Chats** by publisher **cixiangtao**, or search `@id:cixiangtao.codex-project-chats` in VS Code. If the initial Marketplace submission is still under verification, the listing will become available after approval. For local builds, use **Extensions → … → Install from VSIX**.
3. Open a project folder and select **Codex 项目对话** in the Activity Bar. You can also run **Codex Project Chats: 打开项目对话** from the Command Palette.
4. Choose **当前项目** (current project) or **全部项目** (all projects). Search by title and expand a project to select a conversation.
5. Continue in your existing official Codex view. If Codex is on the right, the conversation opens there without creating an editor tab.

[Marketplace listing](https://marketplace.visualstudio.com/items?itemName=cixiangtao.codex-project-chats) · [Report a problem](https://github.com/cixiangtao/codex-project-chats/issues)

## Preview

Both images use sample data, not real conversation history.

| Current project | All projects |
| --- | --- |
| ![Current project with three sample conversations](https://raw.githubusercontent.com/cixiangtao/codex-project-chats/main/docs/images/current-project.png) | ![Projects grouped by cwd, including identical folder names](https://raw.githubusercontent.com/cixiangtao/codex-project-chats/main/docs/images/all-projects.png) |

## What it does

- Groups conversations by exact working directory, with the current project first.
- Supports multi-root workspaces and real paths for symlinked workspace roots. Subdirectories and Git worktrees remain separate groups.
- Searches titles on the server before pagination. Each page contains up to 50 conversations; **加载更多对话** loads the next page. Counts describe the loaded results.
- Shows non-archived, interactive local conversations; excludes subagents and batch sessions.
- Distinguishes projects with identical folder names by their paths.
- Temporarily expands search matches and restores the previous collapse state when the search is cleared.

With no folder open, select **全部项目** to browse all projects. Scope selection is remembered per workspace. There are no custom tags, manual categories, archive/delete actions, or transcript viewer.

## Compatibility and troubleshooting

| Situation | Guidance |
| --- | --- |
| Empty current-project list | The saved `cwd` must match a workspace root. A conversation started in a subdirectory belongs to that subdirectory. Try **全部项目**. |
| Official Codex binary cannot be found | Update/enable the official extension, or set `codexProjectChats.cliPath` to an absolute executable path on the current host. |
| Clicking a conversation fails | Open the official Codex view and retry. Report the VS Code and official extension versions; the upstream URI handler can change. |
| WSL, SSH, or a container | Install both extensions in that remote workspace. Cross-host histories are not combined. Remote behavior is not yet verified end to end. |
| Windows forwarding Codex to WSL from a local window | Open the project in a WSL window instead. This mixed-host mode is unsupported. |

The manifest requires VS Code 1.100 or newer. The tested baseline was VS Code 1.143.1 with `openai.chatgpt` 26.1021.22027 on macOS Apple Silicon; it is evidence for that combination, not a promise about every upstream version.

## Privacy and integration boundary

The extension starts the official bundled `codex app-server` over local stdio and requests `thread/list` with `useStateDbOnly`. It passes only IDs, titles (or a first-message preview when no title exists), working directories, and update times to its local webview. It does not read full transcripts or account credentials, send prompts, or directly write the Codex database. The app-server may maintain its own internal state and logs. This extension adds no telemetry or external webview resources; the official executable remains subject to its own behavior and configuration.

Navigation uses `vscode.env.asExternalUri` and the official extension's `/local/<id>` URI handler to target the current window and reveal the existing sidebar. That upstream URI route is not a stable public API. Project grouping is a navigation feature, not an access-control boundary.

If you installed the prototype as `ikun-local.codex-project-chats`, uninstall it before installing `cixiangtao.codex-project-chats` to avoid duplicate views. Uninstalling this extension does not delete Codex conversations.

## Development

Use Node.js 22 (see `.nvmrc`) and npm:

```sh
npm ci
npm test
npm run package
```

The VSIX is generated in the repository root. There are no runtime npm dependencies; only compiled code, local media, and public documentation are packaged. This is a VS Code extension, not an npm library (`private: true` prevents accidental npm publication).

CI runs the tests on Linux, macOS, and Windows and inspects a VSIX on Linux. One POSIX executable fixture is explicitly skipped on Windows. These checks do not replace a real VS Code/official Codex integration test. Live-history and extension-host tests are opt-in; see [CONTRIBUTING.md](https://github.com/cixiangtao/codex-project-chats/blob/main/CONTRIBUTING.md).

Repository documentation and metadata may be ahead of the last Marketplace package; editing this repository does not update an already uploaded VSIX. CI itself does not publish. A separate [Marketplace release workflow](https://github.com/cixiangtao/codex-project-chats/blob/main/docs/releasing.md) creates version PRs and publishes only after the approved version PR is merged. It remains disabled until its dedicated GitHub App and Microsoft Entra identities are configured. No GitHub Release or npm package is created. The initial 0.1.1 package was submitted manually.

## Support and license

Use [Issues](https://github.com/cixiangtao/codex-project-chats/issues) for bugs and scoped feature requests. Follow [SECURITY.md](https://github.com/cixiangtao/codex-project-chats/blob/main/SECURITY.md) for private vulnerability reports. See [SUPPORT.md](https://github.com/cixiangtao/codex-project-chats/blob/main/SUPPORT.md) for safe diagnostics.

[MIT](https://github.com/cixiangtao/codex-project-chats/blob/main/LICENSE). Independently implemented; no History Viewer source code was copied.
