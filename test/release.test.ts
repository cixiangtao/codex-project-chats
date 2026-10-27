import { expect, test } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateReleaseConfig, validateVersion, validateVersionFiles } from '../scripts/release.mjs';

const root = path.resolve(import.meta.dirname, '..');
const manifest: { name: string; publisher: string; private: boolean; version: string } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const client = fs.readFileSync(path.join(root, 'src/client.ts'), 'utf8');
const changelog = fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8');

interface PreparationConfig {
  git: { commit: boolean; tag: boolean; push: boolean };
  npm: false | { publish: boolean };
  github: { release: boolean };
  gitlab: { release: boolean };
}
const readConfig = (): PreparationConfig => JSON.parse(fs.readFileSync(path.join(root, '.release-it.json'), 'utf8'));

test('version checks enforce package identity, handshake version, and current changelog heading', () => {
  expect(validateVersionFiles(manifest, client, changelog)).toBe(manifest.version);
  expect(() => validateVersionFiles(manifest, client.replace(manifest.version, '9.9.9'), changelog)).toThrow(/stale/);
  expect(() => validateVersionFiles({ ...manifest, publisher: 'other' }, client, changelog)).toThrow();
  expect(() => validateVersionFiles(manifest, client, '# Changelog\n\n## 0.0.1\n')).toThrow(/current version/);
  for (const version of ['1.2.3-beta', 'v1.2.3', '1.2', '1.2.3\nnext']) expect(() => validateVersion(version)).toThrow();
});

test('release preparation cannot commit, tag, push, or publish', () => {
  validateReleaseConfig(readConfig());
  for (const action of ['commit', 'tag', 'push'] as const) {
    const config = readConfig(); config.git[action] = true;
    expect(() => validateReleaseConfig(config)).toThrow();
  }
  for (const mutate of [
    (config: PreparationConfig) => { config.npm = { publish: true }; },
    (config: PreparationConfig) => { config.github.release = true; },
    (config: PreparationConfig) => { config.gitlab.release = true; },
  ]) {
    const config = readConfig(); mutate(config);
    expect(() => validateReleaseConfig(config)).toThrow();
  }
});

test('release-it previews and prepares versions without creating commits or tags', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'project-chats-release-it-'));
  const folder = path.join(temporary, 'work');
  const remote = path.join(temporary, 'remote.git');
  fs.mkdirSync(folder);
  execFileSync('git', ['init', '--bare', remote], { stdio: 'ignore' });
  const git = (...args: string[]) => execFileSync('git', args, { cwd: folder, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const nextVersion = manifest.version.replace(/\d+$/, patch => String(Number(patch) + 1));
  const env = { ...process.env, GITHUB_TOKEN: '', GH_TOKEN: '', NPM_TOKEN: '', CI: 'true' };
  const cli = path.join(root, 'node_modules/release-it/bin/release-it.js');
  const release = (...args: string[]) => execFileSync(process.execPath, [cli, nextVersion, '--ci', ...args], { cwd: folder, encoding: 'utf8', env, timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    fs.mkdirSync(path.join(folder, 'src')); fs.mkdirSync(path.join(folder, 'scripts'));
    for (const name of ['package.json', '.release-it.json', 'src/client.ts', 'scripts/release.mjs', 'CHANGELOG.md']) fs.copyFileSync(path.join(root, name), path.join(folder, name));
    fs.writeFileSync(path.join(folder, '.gitignore'), 'node_modules/\n');
    fs.symlinkSync(path.join(root, 'node_modules'), path.join(folder, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    git('init', '--initial-branch=main');
    git('remote', 'add', 'origin', remote);
    git('add', '.');
    git('-c', 'user.name=Release Fixture', '-c', 'user.email=fixture@example.test', 'commit', '-m', 'chore: fixture baseline');
    git('tag', `v${manifest.version}`);
    git('push', 'origin', 'main', '--tags');
    git('-c', 'user.name=Release Fixture', '-c', 'user.email=fixture@example.test', 'commit', '--allow-empty', '-m', 'fix: exercise release preparation');
    const head = git('rev-parse', 'HEAD');
    const remoteRefs = git('--git-dir', remote, 'show-ref');
    const originalPackage = fs.readFileSync(path.join(folder, 'package.json'), 'utf8');
    release('--dry-run');
    expect(fs.readFileSync(path.join(folder, 'package.json'), 'utf8')).toBe(originalPackage);
    expect(git('status', '--porcelain')).toBe('');
    release();
    const nextPackage = JSON.parse(fs.readFileSync(path.join(folder, 'package.json'), 'utf8'));
    const nextClient = fs.readFileSync(path.join(folder, 'src/client.ts'), 'utf8');
    const nextChangelog = fs.readFileSync(path.join(folder, 'CHANGELOG.md'), 'utf8');
    expect(nextPackage.version).toBe(nextVersion);
    expect(validateVersionFiles(nextPackage, nextClient, nextChangelog)).toBe(nextVersion);
    expect(nextChangelog).toContain('exercise release preparation');
    expect(git('diff', '--name-only').split('\n').sort()).toEqual(['CHANGELOG.md', 'package.json', 'src/client.ts']);
    expect(git('rev-parse', 'HEAD')).toBe(head);
    expect(git('tag', '--list')).toBe(`v${manifest.version}`);
    expect(git('--git-dir', remote, 'show-ref')).toBe(remoteRefs);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
}, 60000);
