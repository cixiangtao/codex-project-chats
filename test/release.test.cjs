const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const load = () => import('../scripts/release.mjs');

function fixture() {
  const oldPackage = { name: 'codex-project-chats', publisher: 'cixiangtao', version: '0.1.1', private: true };
  const oldLock = { version: '0.1.1', packages: { '': { version: '0.1.1' }, 'node_modules/tool': { version: '2.0.0' } } };
  const oldClient = "initialize({ version: '0.1.1' }); // x-release-please-version\n";
  const before = {
    'package.json': JSON.stringify(oldPackage),
    'package-lock.json': JSON.stringify(oldLock),
    '.release-please-manifest.json': '{".":"0.1.1"}',
    'src/client.ts': oldClient,
    'CHANGELOG.md': '# Changelog\n\n## 0.1.1\n',
  };
  const nextLock = structuredClone(oldLock); nextLock.version = nextLock.packages[''].version = '0.1.2';
  const after = {
    'package.json': JSON.stringify({ ...oldPackage, version: '0.1.2' }),
    'package-lock.json': JSON.stringify(nextLock),
    '.release-please-manifest.json': '{".":"0.1.2"}',
    'src/client.ts': oldClient.replace('0.1.1', '0.1.2'),
    'CHANGELOG.md': '# Changelog\n\n## [0.1.2](https://example.test) (2026-10-26)\n',
  };
  return { before, after };
}

test('release admission accepts only the configured App release PR merged into main', async () => {
  const { validateReleasePr } = await load();
  const pr = { merged: true, base: { ref: 'main' }, head: { ref: 'release-please--branches--main', repo: { full_name: 'cixiangtao/codex-project-chats' } }, user: { login: 'release-app[bot]' }, merge_commit_sha: 'a'.repeat(40), labels: [{ name: 'autorelease: pending' }] };
  const expected = { actor: 'release-app', commit: 'a'.repeat(40) };
  validateReleasePr(pr, expected);
  for (const mutate of [p => p.merged = false, p => p.base.ref = 'other', p => p.head.repo.full_name = 'other/fork', p => p.head.ref = 'feature/release', p => p.user.login = 'human', p => p.merge_commit_sha = 'b'.repeat(40), p => p.labels = []]) {
    const changed = structuredClone(pr); mutate(changed);
    assert.throws(() => validateReleasePr(changed, expected));
  }
});

test('release metadata may increase versions while retaining identical product and dependency content', async () => {
  const { validateReleaseFiles } = await load();
  const { before, after } = fixture();
  assert.equal(validateReleaseFiles(before, after), '0.1.2');
});

test('release admission rejects dependency changes, manifest edits, unexpected files, and code hidden next to the version', async () => {
  const { validateReleaseFiles } = await load();
  for (const mutate of [
    a => { const lock = JSON.parse(a['package-lock.json']); lock.packages['node_modules/tool'].version = '9.0.0'; a['package-lock.json'] = JSON.stringify(lock); },
    a => { const pkg = JSON.parse(a['package.json']); pkg.publisher = 'other'; a['package.json'] = JSON.stringify(pkg); },
    a => a['src/extension.ts'] = 'unexpected product change',
    a => a['src/client.ts'] += 'runUnreviewedCode();',
    a => a['.release-please-manifest.json'] = '{".":"0.1.3"}',
  ]) {
    const { before, after } = fixture(); mutate(after);
    assert.throws(() => validateReleaseFiles(before, after));
  }
});

test('release admission rejects equal and older versions', async () => {
  const { validateReleaseFiles } = await load();
  for (const version of ['0.1.1', '0.1.0', '0.0.99']) {
    const { before, after } = fixture();
    const pkg = JSON.parse(after['package.json']); pkg.version = version; after['package.json'] = JSON.stringify(pkg);
    assert.throws(() => validateReleaseFiles(before, after));
  }
});

test('all real version owners agree, and stale protocol versions are rejected', async () => {
  const { validateVersionFiles, validateVersion } = await load();
  const pkg = require('../package.json'); const lock = require('../package-lock.json'); const manifest = require('../.release-please-manifest.json');
  const client = fs.readFileSync(require.resolve('../src/client.ts'), 'utf8');
  assert.equal(validateVersionFiles(pkg, lock, manifest, client), pkg.version);
  assert.throws(() => validateVersionFiles(pkg, lock, manifest, client.replace(pkg.version, '9.9.9')));
  for (const version of ['1.2.3-beta', 'v1.2.3', '1.2', '1.2.3\nnext']) assert.throws(() => validateVersion(version));
});

test('unconfigured automation stops before using a GitHub credential', () => {
  const os = require('node:os'); const path = require('node:path');
  const { execFileSync } = require('node:child_process');
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'project-chats-release-'));
  const output = path.join(folder, 'output');
  try {
    execFileSync(process.execPath, [require.resolve('../scripts/release.mjs'), 'plan'], {
      env: { ...process.env, GITHUB_REPOSITORY: 'cixiangtao/codex-project-chats', GITHUB_REF: 'refs/heads/main', RELEASE_ENABLED: 'false', GITHUB_OUTPUT: output, GH_TOKEN: '' },
    });
    assert.equal(fs.readFileSync(output, 'utf8'), 'mode=disabled\n');
  } finally { fs.rmSync(folder, { recursive: true, force: true }); }
});
