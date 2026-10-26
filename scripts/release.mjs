import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const repository = 'cixiangtao/codex-project-chats';
const releaseBranch = 'release-please--branches--main';
const allowedFiles = new Set(['package.json', 'package-lock.json', 'CHANGELOG.md', '.release-please-manifest.json', 'src/client.ts']);
const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function validateVersion(value) {
  assert.equal(typeof value, 'string');
  assert(semver.test(value), 'Only numeric VS Code versions are supported.');
  return value;
}

export function validateReleasePr(pr, { actor, commit }) {
  assert(pr.merged && pr.base?.ref === 'main', 'The release PR must be merged into main.');
  assert.equal(pr.head?.repo?.full_name, repository, 'The release branch must belong to this repository.');
  assert.equal(pr.head.ref, releaseBranch, 'Not a Release Please branch.');
  assert(actor && pr.user?.login === `${actor}[bot]`, 'Release PR author must match the configured GitHub App.');
  assert.equal(pr.merge_commit_sha, commit, 'The requested commit is not this PR merge.');
  assert(pr.labels.some(label => ['autorelease: pending', 'autorelease: tagged'].includes(label.name)), 'Missing release lifecycle label.');
}

function jsonAt(content) { return JSON.parse(content); }
function clientWithoutVersion(content) {
  const matches = [...content.matchAll(/version: '(\d+\.\d+\.\d+)'/g)];
  assert.equal(matches.length, 1, 'Expected one app-server version.');
  assert(content.includes('x-release-please-version'), 'Missing version marker.');
  return content.replace(/version: '\d+\.\d+\.\d+'/, "version: '<version>'");
}

/** Release PRs may change version metadata, never arbitrary product code or dependencies. */
export function validateReleaseFiles(before, after) {
  const changed = Object.keys(after);
  assert(changed.length && changed.every(name => allowedFiles.has(name)), 'Unexpected file in the release diff.');
  assert([...allowedFiles].every(name => changed.includes(name)), 'Missing release metadata.');
  const previous = jsonAt(before['package.json']);
  const next = jsonAt(after['package.json']);
  const version = validateVersion(next.version);
  const previousParts = validateVersion(previous.version).split('.').map(BigInt);
  const nextParts = version.split('.').map(BigInt);
  const firstDifference = nextParts.findIndex((part, index) => part !== previousParts[index]);
  assert(firstDifference !== -1 && nextParts[firstDifference] > previousParts[firstDifference], 'Version must increase.');
  assert.equal(next.publisher, 'cixiangtao');
  assert.equal(next.name, 'codex-project-chats');
  assert.deepEqual({ ...next, version: previous.version }, previous, 'package.json may change only its version.');
  assert.deepEqual(jsonAt(after['.release-please-manifest.json']), { '.': version });
  assert(new RegExp(`^## \\[?${version.replaceAll('.', '\\.')}($|\\]|\\s)`, 'm').test(after['CHANGELOG.md']), 'Changelog must contain the new version.');
  if (after['package-lock.json']) {
    const oldLock = jsonAt(before['package-lock.json']);
    const newLock = jsonAt(after['package-lock.json']);
    assert.equal(newLock.version, version);
    assert.equal(newLock.packages[''].version, version);
    newLock.version = oldLock.version;
    newLock.packages[''].version = oldLock.packages[''].version;
    assert.deepEqual(newLock, oldLock, 'A release PR must not change dependencies.');
  }
  if (after['src/client.ts']) assert.equal(clientWithoutVersion(before['src/client.ts']), clientWithoutVersion(after['src/client.ts']), 'Product code changed in a release PR.');
  return version;
}

export function validateVersionFiles(packageJson, lock, manifest, client) {
  const version = validateVersion(packageJson.version);
  assert.equal(lock.version, version);
  assert.equal(lock.packages[''].version, version);
  assert.equal(manifest['.'], version);
  assert(client.includes(`version: '${version}'`), 'App-server client version is stale.');
  return version;
}

function gh(path, { method = 'GET', body, paginate = false } = {}) {
  const args = ['api', path, '--method', method];
  if (paginate) args.push('--paginate', '--slurp');
  if (body) args.push('--input', '-');
  const output = execFileSync('gh', args, { input: body ? JSON.stringify(body) : undefined, encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] });
  return output.trim() ? JSON.parse(output) : null;
}
function git(...args) { return execFileSync('git', args, { encoding: 'utf8' }).trimEnd(); }
function output(values) {
  assert(process.env.GITHUB_OUTPUT, 'Expected GitHub Actions output file.');
  for (const [key, value] of Object.entries(values)) appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}
function assertWorkflow() {
  assert.equal(process.env.GITHUB_REPOSITORY, repository);
  assert.equal(process.env.GITHUB_REF, 'refs/heads/main', 'Release entry point must run on main.');
}
function localVersion() {
  return validateVersionFiles(jsonAt(readFileSync('package.json', 'utf8')), jsonAt(readFileSync('package-lock.json', 'utf8')), jsonAt(readFileSync('.release-please-manifest.json', 'utf8')), readFileSync('src/client.ts', 'utf8'));
}

async function main() {
  const command = process.argv[2];
  if (command === 'versions') { console.log(`Version files agree: ${localVersion()}`); return; }
  assertWorkflow();
  if (command === 'plan') {
    if (process.env.VERIFY_RELEASE_APP === 'true') {
      assert.equal(process.env.GITHUB_EVENT_NAME, 'workflow_dispatch', 'App checks must be requested manually.');
      output({ mode: 'app-check' });
      return;
    }
    if (process.env.RELEASE_ENABLED !== 'true') {
      output({ mode: 'disabled' });
      console.log('Release automation is disabled. Complete docs/releasing.md before enabling it.');
      return;
    }
    const requested = process.env.RELEASE_PR || '';
    assert(!requested || /^[1-9]\d*$/.test(requested), 'Invalid recovery PR number.');
    let pr;
    if (requested) pr = gh(`repos/${repository}/pulls/${requested}`);
    else {
      const associated = gh(`repos/${repository}/commits/${process.env.GITHUB_SHA}/pulls`);
      const candidates = associated.filter(item => item.merged_at && item.merge_commit_sha === process.env.GITHUB_SHA && item.head.ref === releaseBranch);
      assert(candidates.length <= 1, 'Ambiguous release PR.');
      if (candidates[0]) pr = gh(`repos/${repository}/pulls/${candidates[0].number}`);
    }
    if (!pr) { output({ mode: 'controller' }); return; }
    const branch = gh(`repos/${repository}/branches/main`);
    assert(branch.protected, 'main must remain protected before publishing.');
    const commit = pr.merge_commit_sha;
    assert(/^[a-f0-9]{40}$/.test(commit));
    validateReleasePr(pr, { actor: process.env.RELEASE_APP_SLUG, commit });
    // Only merged protected-branch ancestry can become a recovery target.
    git('merge-base', '--is-ancestor', commit, 'origin/main');
    const metadata = gh(`repos/${repository}/git/commits/${commit}`);
    assert.equal(metadata.parents.length, 1, 'Use squash merges for release PRs.');
    const parent = metadata.parents[0].sha;
    const names = git('diff', '--name-only', parent, commit).split('\n').filter(Boolean);
    const before = {}; const after = {};
    for (const name of names) {
      assert(allowedFiles.has(name), `Unexpected release file: ${name}`);
      before[name] = git('show', `${parent}:${name}`);
      after[name] = git('show', `${commit}:${name}`);
    }
    const version = validateReleaseFiles(before, after);
    const checks = gh(`repos/${repository}/commits/${pr.head.sha}/check-runs?per_page=100`);
    assert(checks.check_runs.some(check => check.name === 'CI' && check.app?.id === 15368 && check.conclusion === 'success'), 'Release PR has not passed the required GitHub Actions CI.');
    output({ mode: 'release', commit, version, pr: String(pr.number), tag: `v${version}` });
    return;
  }
  if (command === 'identity') {
    const version = localVersion();
    assert.equal(version, process.env.RELEASE_VERSION);
    assert.equal(git('rev-parse', 'HEAD'), process.env.RELEASE_COMMIT);
    writeFileSync('release-identity.json', JSON.stringify({ repository, version, commit: process.env.RELEASE_COMMIT, pr: Number(process.env.RELEASE_PR) }, null, 2) + '\n');
    return;
  }
  if (command === 'record') {
    const version = validateVersion(process.env.RELEASE_VERSION);
    const commit = process.env.RELEASE_COMMIT;
    assert(/^[a-f0-9]{40}$/.test(commit));
    const pr = gh(`repos/${repository}/pulls/${process.env.RELEASE_PR}`);
    validateReleasePr(pr, { actor: process.env.RELEASE_APP_SLUG, commit });
    const tag = `v${version}`;
    const tags = gh(`repos/${repository}/git/matching-refs/tags/${tag}`);
    const exact = tags.find(item => item.ref === `refs/tags/${tag}`);
    if (exact) assert.equal(exact.object.sha, commit, 'Existing release tag points at a different commit.');
    else gh(`repos/${repository}/git/refs`, { method: 'POST', body: { ref: `refs/tags/${tag}`, sha: commit } });
    const labels = pr.labels.map(label => label.name).filter(label => label !== 'autorelease: pending');
    if (!labels.includes('autorelease: tagged')) labels.push('autorelease: tagged');
    gh(`repos/${repository}/issues/${pr.number}/labels`, { method: 'PUT', body: { labels } });
    console.log(`Recorded ${tag} at ${commit}; no GitHub Release was created.`);
    return;
  }
  throw new Error(`Unknown release command: ${command}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
