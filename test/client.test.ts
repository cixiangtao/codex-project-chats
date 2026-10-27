import { expect, test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { CodexClient } from '../src/client';

interface WireCall { method: string; params: Record<string, unknown> }

test.skipIf(process.platform === 'win32')('stdio handshake and list requests keep project/search filters on every page', async () => {
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
  const client = new CodexClient(binary, '9.8.7');
  try {
    const first = await client.list(['/repo/a', '/repo/b'], '登录', null);
    assert.equal(first.nextCursor, 'second');
    await client.list(['/repo/a', '/repo/b'], '登录', first.nextCursor);
    await client.list(undefined, '', null);
    const calls: WireCall[] = (await fs.readFile(trace, 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    assert.deepEqual(calls.slice(0, 2).map(call => call.method), ['initialize', 'initialized']);
    expect(calls[0]?.params.clientInfo).toMatchObject({ version: '9.8.7' });
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
    assert.equal(pages[1]?.params.cursor, 'second');
    expect(pages[2]?.params).not.toHaveProperty('cwd');
    expect(pages[2]?.params).not.toHaveProperty('searchTerm');
    const before = pages.length;
    assert.deepEqual(await client.list([], '', null), { chats: [], nextCursor: null });
    const after = (await fs.readFile(trace, 'utf8')).trim().split('\n').map(line => JSON.parse(line)).filter(call => call.method === 'thread/list');
    assert.equal(after.length, before);
  } finally { client.dispose(); await fs.rm(folder, { recursive: true, force: true }); }
});

for (const [language, message] of [['en', /Could not start Codex/], ['zh-CN', /无法启动/]] as const) {
  test(`a missing executable produces a recoverable error in ${language}`, async () => {
    const client = new CodexClient('/missing/codex-executable-for-test', '9.8.7', language);
    try { await assert.rejects(client.list(undefined, '', null), message); }
    finally { client.dispose(); }
  });
}
