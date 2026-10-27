import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Marketplace versions use ordinary numeric semver on the stable channel. */
export function validateVersion(version) {
  assert.equal(typeof version, 'string');
  assert(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version), 'Only numeric VS Code versions are supported.');
  return version;
}

/** Keep the package and local app-server handshake on the same version. */
export function validateVersionFiles(manifest, client, changelog) {
  const version = validateVersion(manifest.version);
  assert.equal(manifest.name, 'codex-project-chats');
  assert.equal(manifest.publisher, 'cixiangtao');
  assert.equal(manifest.private, true);
  const versions = [...client.matchAll(/version: '(\d+\.\d+\.\d+)'/g)];
  assert.equal(versions.length, 1, 'Expected exactly one app-server version.');
  assert.equal(versions[0][1], version, 'App-server client version is stale.');
  const heading = changelog.split(/\r?\n/).find(line => line.startsWith('## '));
  assert(heading === `## ${version}` || heading?.startsWith(`## [${version}]`) || heading?.startsWith(`## ${version} (`),
    'Changelog must start with the current version.');
  return version;
}

/** Local release preparation must not publish, create tags or commits, or push. */
export function validateReleaseConfig(config) {
  for (const action of ['commit', 'tag', 'push']) assert.equal(config.git?.[action], false, `Disable git.${action} during release preparation.`);
  assert.equal(config.npm, false, 'npm publication must stay disabled.');
  assert.equal(config.github?.release, false, 'GitHub Releases must stay disabled.');
  assert.equal(config.gitlab?.release, false, 'GitLab releases must stay disabled.');
}

function main() {
  assert.equal(process.argv[2], 'check', 'Use the check command. Version preparation is owned by release-it.');
  const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
  const version = validateVersionFiles(manifest, readFileSync('src/client.ts', 'utf8'), readFileSync('CHANGELOG.md', 'utf8'));
  validateReleaseConfig(JSON.parse(readFileSync('.release-it.json', 'utf8')));
  console.log(`Release preparation checked: ${version}; publication, commits, tags, and pushes are disabled.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
