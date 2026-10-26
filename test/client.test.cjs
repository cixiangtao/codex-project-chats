const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { CodexClient } = require('../dist/client.js');

test('stdio handshake and list requests keep project/search filters on every page', {
  skip: process.platform === 'win32' ? 'Executable script fixture requires POSIX; this is not a Windows runtime test.' : false,
}, async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'project-chats-test-'));
  const binary = path.join(folder, 'codex-fixture');
  const trace = path.join(folder, 'trace.jsonl');
  await fs.writeFile(binary, `#!/usr/bin/env node
const readline = require('node:readline'); const fs = require('node:fs');
readline.createInterface({input:process.stdin}).on('line', line => {
  const msg=JSON.parse(line); fs.appendFileSync(${JSON.stringify(trace)}, line+'\\n');
  if (msg.id === undefined) return;
  const result=msg.method==='initialize' ? {} : {data:[{id:'thread-0001',cwd:'/repo/a',name:'样例',updatedAt:10}],nextCursor:msg.params.cursor?null:'second'};
  process.stdout.write(JSON.stringify({id:msg.id,result})+'\\n');
});
`, { mode: 0o700 });
  const client = new CodexClient(binary);
  try {
    const first = await client.list(['/repo/a', '/repo/b'], '登录', null);
    assert.equal(first.nextCursor, 'second');
    await client.list(['/repo/a', '/repo/b'], '登录', first.nextCursor);
    await client.list(undefined, '', null);
    const calls = (await fs.readFile(trace, 'utf8')).trim().split('\n').map(JSON.parse);
    assert.deepEqual(calls.slice(0, 2).map(call => call.method), ['initialize', 'initialized']);
    const pages = calls.filter(call => call.method === 'thread/list');
    for (const call of pages.slice(0, 2)) {
      assert.deepEqual(call.params.cwd, ['/repo/a', '/repo/b']);
      assert.equal(call.params.searchTerm, '登录');
      assert.equal(call.params.useStateDbOnly, true);
      assert.equal(call.params.sortKey, 'updated_at');
      assert.equal(call.params.archived, false);
      assert.equal(call.params.limit, 50);
      assert.deepEqual(call.params.sourceKinds, ['vscode', 'cli', 'appServer']);
    }
    assert.equal(pages[1].params.cursor, 'second');
    assert.equal('cwd' in pages[2].params, false);
    assert.equal('searchTerm' in pages[2].params, false);
    const before = pages.length;
    assert.deepEqual(await client.list([], '', null), { chats: [], nextCursor: null });
    const after = (await fs.readFile(trace, 'utf8')).trim().split('\n').map(JSON.parse).filter(call => call.method === 'thread/list');
    assert.equal(after.length, before);
  } finally { client.dispose(); await fs.rm(folder, { recursive: true, force: true }); }
});

test('a missing executable produces a recoverable error', async () => {
  const client = new CodexClient('/missing/codex-executable-for-test');
  try { await assert.rejects(client.list(undefined, '', null), /无法启动/); }
  finally { client.dispose(); }
});
