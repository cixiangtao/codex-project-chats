# Marketplace releases

Marketplace packages are uploaded manually. release-it prepares the version and changelog locally; it does not commit, create tags, push, publish an npm package, or create a GitHub Release. Its Git initialization fetches remote refs to determine the changelog baseline, so preparation needs access to the Git remote. No publishing credentials are required.

The previous disabled Release Please / Microsoft Entra workflow has been removed. Existing remote App credentials and repository variables are not managed by this local configuration.

## Prepare a version

Use Node.js 24.18.0 and pnpm 12.15.0 as declared in `.nvmrc` and `packageManager`. Install with `pnpm install --frozen-lockfile`. See [CONTRIBUTING.md](../CONTRIBUTING.md) for environment setup.

Before preparing another version, resolve any pending Marketplace upload and verify/tag its exact commit. The last public version tag must be present in Git so release-it can generate the correct changelog range. Use Conventional Commit squash titles for product changes.

1. Start a clean `codex/` branch from current `main`, with product changes already committed. Preview a patch release:

   ```sh
   pnpm run release:dry patch
   ```

   Use `minor` or `major` when appropriate. The dry run previews changes without writing version files. Review the proposed version and changes since the latest public tag.

2. Prepare that version:

   ```sh
   pnpm run release:prepare patch
   ```

   release-it updates `package.json` and `CHANGELOG.md`. It runs consistency checks before and after preparation. Review the generated changelog and edit its wording if needed. `pnpm-lock.yaml` does not store the root extension version and needs no version-only edit.

3. Validate the prepared change:

   ```sh
   pnpm run check
   pnpm run lint
   pnpm run format:check
   pnpm test
   pnpm run release:check
   python3 -m unittest discover -s test -p '*_test.py'
   pnpm audit --audit-level=high
   pnpm run package
   python3 scripts/verify-vsix.py
   ```

4. Commit and submit the prepared changes through a PR. Merge after required CI passes. The three-platform tests and Linux package inspection remain required; release-it does not replace them.

To generate documentation screenshots with synthetic data, run `pnpm run preview /tmp/codex-project-chats-preview.html`. Append `en` for English; the default is Simplified Chinese. Never capture real history or personal paths for public documentation.

## Upload and verify

1. Download the inspected VSIX from the merged commit's CI artifact into `release-artifact/<version>/`, or rebuild from that exact commit and run `python3 scripts/verify-vsix.py <package.vsix>`. Retain the commit SHA and package checksum beside the inspected package. Ordinary `pnpm run package` builds go to `release-artifact/codex-project-chats-<version>.vsix`; `python3 scripts/verify-vsix.py` checks that default output. The directory is created automatically and ignored by Git. A new build can replace the same version's ordinary output, so preserve the exact inspected upload in its version subdirectory. Pass `--out <path>` to override the build output location when needed.
2. The maintainer opens the [publisher management page](https://marketplace.visualstudio.com/manage/publishers/cixiangtao), selects the existing **Codex Project Chats** extension, and uploads the VSIX as an update. Keep publisher `cixiangtao` and extension ID `codex-project-chats` unchanged. For agent-assisted releases, the agent prepares and inspects the package and the maintainer performs the browser upload.
3. Wait for Marketplace validation. An accepted upload is submitted, not yet a public release. Once public, verify every extension payload file against the inspected local package:

   ```sh
   pnpm run release:verify release-artifact/<version>/codex-project-chats-<version>.vsix
   ```

4. Only after public payload verification succeeds, record a lightweight tag at the exact merged commit:

   ```sh
   git tag v<version> <merged-commit-sha>
   git push origin refs/tags/v<version>
   ```

A tag does not trigger an upload. Never tag a pending or mismatched Marketplace package. If validation is still pending, keep the inspected artifact and retry public verification later; do not invent another version to hide a pending upload.

## Retry preparation

Preparation requires a clean tracked working tree. If a hook fails after files were updated, inspect the diff and repair those files before rerunning checks. To abandon preparation, restore only the two version files after confirming that their changes came solely from this preparation. Do not use a repository-wide hard reset or change an already public version.
