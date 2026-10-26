import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const identity = JSON.parse(readFileSync('release-identity.json', 'utf8'));
assert.equal(identity.repository, 'cixiangtao/codex-project-chats');
assert.equal(identity.commit, process.env.RELEASE_COMMIT);
assert.equal(identity.version, process.env.RELEASE_VERSION);
assert.equal(identity.pr, Number(process.env.RELEASE_PR));
console.log('Downloaded artifact belongs to the approved release PR and commit.');
