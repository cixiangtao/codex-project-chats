// Run only with VS Code's --extensionTestsPath and an isolated --user-data-dir.
const vscode = require('vscode');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

async function until(fn, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const value = await fn(); if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Extension host view did not become ready.');
}
exports.run = async () => {
  const manifest = require('../package.json');
  const extension = vscode.extensions.getExtension(`${manifest.publisher}.${manifest.name}`);
  assert(extension);
  const api = await extension.activate();
  await vscode.commands.executeCommand('codexProjectChats.open');
  const state = await until(() => { const s = api.snapshot(); return s.ready && !s.busy && s; });
  assert.equal(state.error, '');
  assert.equal(state.scope, 'current');
  assert.equal(state.count, 3);
  let routingVerified = false;
  let noEditorCreated = false;
  if (process.env.PROJECT_CHATS_TEST_THREAD) {
    const { openInCodex } = require('../dist/routing.js');
    const tabsBefore = vscode.window.tabGroups.all.flatMap(group => group.tabs).length;
    await openInCodex(process.env.PROJECT_CHATS_TEST_THREAD);
    const logRoot = path.join(process.env.PROJECT_CHATS_TEST_WORK, 'vscode-user', 'logs');
    await until(async () => {
      const sessions = (await fs.readdir(logRoot)).sort().reverse();
      for (const session of sessions.slice(0, 1)) {
        try {
          const log = await fs.readFile(path.join(logRoot, session, 'window1/exthost/openai.chatgpt/Codex.log'), 'utf8');
          return log.includes('Handling URI') && log.includes(`/local/${process.env.PROJECT_CHATS_TEST_THREAD}`);
        } catch { /* Official log file may not have flushed yet. */ }
      }
      return false;
    });
    const tabsAfter = vscode.window.tabGroups.all.flatMap(group => group.tabs);
    assert.equal(tabsAfter.length, tabsBefore);
    assert(!tabsAfter.some(tab => tab.input instanceof vscode.TabInputCustom && tab.input.viewType === 'chatgpt.conversationEditor'));
    noEditorCreated = true;
    routingVerified = true;
  }
  await fs.writeFile(path.join(process.env.PROJECT_CHATS_TEST_WORK, 'host-result.json'), JSON.stringify({ webviewReady: true, protocolConnected: true, currentProjectCount: state.count, routingVerified, noEditorCreated }));
  // Keep this isolated host available for one visual pass. The harness creates the release file afterwards.
  if (process.env.PROJECT_CHATS_KEEP_HOST) await until(async () => {
    try { await fs.access(path.join(process.env.PROJECT_CHATS_TEST_WORK, 'release-host')); return true; } catch { return false; }
  }, 600000);
};
