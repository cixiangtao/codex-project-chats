# Changelog

## [1.1.1](https://github.com/cixiangtao/codex-project-chats/compare/v1.1.0...v1.1.1) (2026-10-27)

### Bug Fixes

* **view:** 🐛 cancel work when the conversation view closes ([cc42275](https://github.com/cixiangtao/codex-project-chats/commit/cc4227519703397681d3b8e45d971fc53f624272))
* **webview:** 🐛 preserve focus and keep conversation details current ([81596ea](https://github.com/cixiangtao/codex-project-chats/commit/81596ea8ba76cfa35966e3b27ad17a96a03f63a6))
* **webview:** 🐛 recover legacy project expansion preferences ([4f846d1](https://github.com/cixiangtao/codex-project-chats/commit/4f846d17f549bbb64fe5373b7fba24c2cb886e47))

### Maintenance

- Build the React and TypeScript interface with Vite, with a synthetic-data development preview and hot updates.
- Organize Webview components, hooks, styles, and tests by responsibility; preserve the compact conversation layout and theme integration.
- Adopt pnpm, Vitest, and release-it for local development and release preparation. Marketplace uploads remain manual.
- Add Oxlint and Oxfmt checks to CI, including import, package/script, and Tailwind class sorting.

## 1.1.0

- Follow the VS Code display language with Simplified Chinese for Chinese locales and English as the fallback.
- Localize conversation lists, hover details, relative times, loading and empty states, accessibility labels, and extension-owned error messages.
- Localize Activity Bar labels, commands, and executable-path settings through native VS Code language resources.
- Preserve original conversation titles, project paths, and upstream diagnostics without translation.
- Add English sample screenshots and synchronize bilingual usage and language-switching instructions.

## 1.0.0

- Publish the first stable release and remove the Marketplace preview designation.
- Use compact single-line conversation rows with right-aligned last-update times.
- Show full titles, update timestamps, and project paths in compact hover details, keeping a clear pointer lane on the left for switching conversations.
- Support keyboard focus and Escape dismissal for conversation details.
- Refresh the store and Activity Bar icons with a Codex blossom and project-folder badge.
- Update bilingual usage instructions and sample screenshots; document the current manual Marketplace release procedure.

## 0.1.1

- Open conversations in the existing official Codex view in the current VS Code window, respecting the sidebar position instead of creating editor tabs.
- Expand search matches temporarily and restore previous collapse state when the search is cleared.
- Show paths for projects with identical folder names even while collapsed.
- Add a store icon, installation instructions, and compatibility guidance for the first Marketplace preview submission.

## 0.1.0

- Initial local prototype with working-directory grouping, current/all-project scope, title search, and pagination.
