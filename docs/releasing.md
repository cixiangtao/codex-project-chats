# Marketplace releases

## Current activation state

**Manual Marketplace upload is the current release method.** The maintainer has chosen this path while Microsoft Entra setup is unavailable. The prepared automated workflow remains disabled: keep `RELEASE_AUTOMATION_ENABLED` unset or `false` until the identities below are configured and verified. A successful GitHub App check does not establish Marketplace publishing access.

Only Marketplace receives extension releases. No GitHub Release or npm package is created. Do not upload a version manually while automated publishing is enabled.

## Current manual release procedure

1. Prepare a focused PR with the product changes, updated screenshots and usage instructions. Keep `package.json`, the two root version fields in `package-lock.json`, `.release-please-manifest.json`, the marked version in `src/client.ts`, and `CHANGELOG.md` in sync.
2. Run the following with Node.js 22, then merge the PR only after required CI passes:

   ```sh
   npm run check
   npm test
   node scripts/release.mjs versions
   python3 -m unittest discover -s test -p '*_test.py'
   npm audit --audit-level=high
   npm run package
   python3 scripts/verify-vsix.py
   ```

3. Use the inspected VSIX from the merged commit's CI artifact, or rebuild from that exact commit and inspect it again. Open the [publisher management page](https://marketplace.visualstudio.com/manage/publishers/cixiangtao), select the existing **Codex Project Chats** extension, and upload the VSIX as an update. Keep publisher `cixiangtao` and extension ID `codex-project-chats` unchanged.
   For agent-assisted releases, the agent prepares and verifies the package, the maintainer performs the final browser upload, and the agent verifies the public payload and records the version tag afterward.
4. Wait for Marketplace validation. An accepted upload is **submitted**, not yet a public release. After it is public, verify the complete extension payload against the inspected package:

   ```sh
   python3 scripts/marketplace.py codex-project-chats-<version>.vsix
   ```

5. Only after that verification succeeds, create and push a lightweight `v<version>` Git tag at the exact merged commit. Leave automated publishing disabled. The synchronized manifest and tag provide a baseline if Release Please is enabled later.

Use `node test/preview.cjs /tmp/codex-project-chats-preview.html` after building to generate the production interface with synthetic data for screenshots. Add `en` as the third argument for the English interface; the preview defaults to Simplified Chinese. Never capture real history or personal project paths for public documentation.

## Future automated operation

The sections below describe the prepared workflow, not the current manual upload path. Before switching, verify the public Marketplace version, manifest and latest version tag agree so the controller starts from the manually published baseline.

1. Merge ordinary feature/fix PRs through `main`'s required CI. Use Conventional Commit squash titles.
2. Release Please creates or updates `release-please--branches--main` using a dedicated GitHub App. It updates only `package.json`, the root version fields in `package-lock.json`, `CHANGELOG.md`, `.release-please-manifest.json`, and the marked client version in `src/client.ts`.
3. Review the version PR and merge it after required CI passes. Only this specific merge authorizes publishing that version. Other open PRs do not block release.
4. `.github/workflows/release.yml` verifies the PR author, branch, merge commit, successful CI, protected-branch ancestry, and allowed metadata-only diff. It rebuilds and inspects one VSIX and records its commit/PR identity and checksum.
5. The `marketplace` environment job downloads that same artifact, obtains a short-lived Microsoft Entra token, uploads through `vsce`, and reconciles the public Marketplace payload before tagging the commit. No browser upload or CAPTCHA is part of this pipeline.

The manifest's `preview: false` marks the extension as a stable product. Both release paths use ordinary numeric VS Code versions on the regular Marketplace channel. After public payload verification, the automated path creates the tag and lifecycle labels itself.

## One-time GitHub App setup

Create a private GitHub App owned by `cixiangtao`, with its homepage pointing to this repository. Disable webhooks and request only these **repository** permissions:

- Contents: read and write (create/update the release branch).
- Pull requests: read and write (maintain the version PR).
- Issues: read and write (release lifecycle labels).
- Metadata: read (implicit).

Do not grant administration, secrets, workflows, organization, or account permissions. Install it only on `cixiangtao/codex-project-chats`. The workflow also explicitly scopes each short-lived installation token to this repository and revokes it after the job.

Set repository variables `RELEASE_APP_CLIENT_ID` (the App Client ID, not its numeric App ID) and `RELEASE_APP_SLUG` (without `[bot]`). Store its private key as the repository Actions secret `RELEASE_APP_PRIVATE_KEY`. Never paste the private key into chat, an issue, a workflow file, or a commit. A dedicated App is needed because PRs created with the default `GITHUB_TOKEN` do not reliably start the required PR workflows without human approval.

The controller does not merge PRs or bypass branch protection. The maintainer decides when to merge a version PR.

## One-time Microsoft Entra setup

A personal Microsoft login alone does not establish that a usable Entra workforce tenant exists. Use a tenant that you are authorized to use for this project. Do not use an employer tenant or start a paid subscription without explicit permission. Eligibility for a new tenant or Azure account must be confirmed in Microsoft's current account flow.

In that tenant:

1. Register a dedicated application/service principal for this publisher. Do not create a client secret or grant subscription resource roles for this workflow. Azure Login supports tenant-level OIDC sign-in without an Azure subscription.
2. Add a federated credential for GitHub Actions with these exact values:

```json
{
  "name": "github-marketplace",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:cixiangtao/codex-project-chats:environment:marketplace",
  "audiences": ["api://AzureADTokenExchange"]
}
```

3. Following the [official Marketplace identity instructions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#secure-automated-publishing-to-visual-studio-marketplace), retrieve the identity's Azure DevOps profile ID using the dedicated identity:

```sh
az rest --url https://app.vssps.visualstudio.com/_apis/profile/profiles/me --resource 499b84ac-1321-427f-aa17-267ca6975798
```

Add that returned identity to publisher `cixiangtao` with the **Contributor** role. Do not give it Owner access or add it to other publishers. This step grants the identity permission to upload/update publisher extensions and must be approved by the publisher owner.

4. In the GitHub `marketplace` environment, set variables `AZURE_CLIENT_ID` and `AZURE_TENANT_ID`. Restrict deployment to the protected `main` branch. No Azure client secret or `VSCE_PAT` is used.

Creating the GitHub App, installing it, and granting the Entra identity publisher access are separate security-sensitive authorization steps. They are not implied by a checked-in workflow.

## Activation and verification

- Confirm the GitHub App installation and Marketplace Contributor membership against their actual dashboards.
- To verify the GitHub side before Entra is available, run **Marketplace release** on `main` with **verify_app=true**. This reads the configured private key in Actions, checks a read-only installation token for exactly this repository, and revokes it after the job. It neither creates a version PR nor uploads, labels, or tags a version. It works while the main publishing switch is disabled.
- Confirm `marketplace` environment branch protection and the exact OIDC subject.
- Set repository variable `RELEASE_AUTOMATION_ENABLED=true` only after these prerequisites are ready.
- Run **Marketplace release** manually with no `release_pr` to exercise the controller. The bootstrap SHA excludes the initial source import from release calculations. Configuration-only `ci:`/`docs:` commits should not publish a version.
- After a later feature/fix merge, confirm the generated release PR actually starts and passes CI without a manual empty commit or weakened branch protection.
- A manual run with a merged `release_pr` and **dry_run=true** proves admission and artifact building without upload, labels, or tags. A dry run does not validate Marketplace write access.
- A real version publication still requires the maintainer to merge its specific release PR. Do not merge it just to test credential setup without approving the resulting release.

## Retry and recovery

The single **Marketplace release** workflow is also the recovery entry point. Run it on `main`, enter the merged release PR number, and keep **dry_run=true** until the selected version and commit have been confirmed. Disable dry run only to retry that authorized release.

No tag push triggers publication. A manually fabricated tag or an unmerged release branch cannot satisfy the release gate. Existing tags are accepted only at the exact approved merge commit.

Before uploading, the workflow checks whether the version is already public. It skips uploading only if every `extension/` file matches the inspected artifact. A different payload under the same version is an error; `--skip-duplicate` is deliberately not used. A rejected upload can reconcile only after the exact matching version is public.

Marketplace validation may take longer than the workflow's five-minute public check. In that case, the run fails clearly without recording success or creating a version tag. Inspect the Marketplace status and rerun the same workflow/PR after validation. Do not invent another version just to hide a pending upload. Downloaded artifacts are retained for 30 days; rebuilt packages must still match the published extension payload.
