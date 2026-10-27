const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function router({ accepted = true, scheme = 'vscode', installed = true, language = 'en' } = {}) {
  const calls = [];
  const resolved = { scheme: 'vscode', authority: 'openai.chatgpt', path: '/local/thread-0001', query: 'windowId=7' };
  const api = {
    extensions: { getExtension: id => { calls.push(['extension', id]); return installed ? { activate: async () => { calls.push(['activate']); } } : undefined; } },
    commands: { executeCommand: async (...args) => { calls.push(['command', ...args]); } },
    Uri: { from: value => value },
    env: { language, uriScheme: scheme, asExternalUri: async uri => { calls.push(['resolve', uri]); return resolved; },
      openExternal: async uri => { calls.push(['open', uri]); return accepted; } },
  };
  const exports = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../dist/routing.js'), 'utf8'), {
    exports, require: name => {
      if (name === 'vscode') return api;
      assert.equal(name, './i18n'); return require('../dist/i18n.js');
    },
  });
  return { open: exports.openInCodex, calls, resolved };
}

test('sidebar route resolves the current window, reveals Codex, and forwards the resolved URI unchanged', async () => {
  const { open, calls, resolved } = router();
  await open('thread-0001');
  assert.deepEqual(calls.map(call => call[0]), ['extension', 'activate', 'resolve', 'command', 'open']);
  assert.equal(calls[2][1].authority, 'openai.chatgpt');
  assert.equal(calls[2][1].path, '/local/thread-0001');
  assert.equal(calls[3][1], 'chatgpt.openSidebar');
  assert.equal(calls[4][1], resolved);
  assert(!calls.some(call => call.includes('vscode.openWith')));
});

test('sidebar routing uses the running editor scheme and rejects failed routing', async () => {
  const { open, calls } = router({ accepted: false, scheme: 'vscode-insiders' });
  await assert.rejects(open('thread-0001'), /did not accept/);
  assert.equal(calls[2][1].scheme, 'vscode-insiders');
});

test('invalid IDs and missing official extension never open a view or dispatch an external URI', async () => {
  const invalid = router();
  await assert.rejects(invalid.open('../wrong-id'), /format is invalid/);
  assert.equal(invalid.calls.length, 0);
  const missing = router({ installed: false });
  await assert.rejects(missing.open('thread-0001'), /Enable the official/);
  assert.equal(missing.calls.length, 1);
});

test('routing errors follow the VS Code display language', async () => {
  const { open } = router({ accepted: false, language: 'zh-cn' });
  await assert.rejects(open('thread-0001'), /未接受/);
});
