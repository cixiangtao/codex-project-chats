const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parsePage, groupChats, pathKey, uniquePaths } = require('../dist/model.js');

test('protocol parser rejects a broken page and skips malformed thread records', () => {
  assert.throws(() => parsePage({ data: null }));
  const page = parsePage({ data: [
    { id: 'thread-0001', cwd: '/apps/a', name: '  修复\n登录 ', updatedAt: 10 },
    { id: 'bad/<script>', cwd: '/apps/a', preview: 'wrong' },
    { id: 'thread-0002', cwd: '/apps/b', name: null, preview: '<script>not HTML</script>', updatedAt: 20 },
    { id: 'thread-0003', preview: 'no cwd' },
  ], nextCursor: 'page-2' });
  assert.equal(page.chats.length, 2);
  assert.equal(page.chats[0].title, '修复 登录');
  assert.equal(page.chats[1].title, '<script>not HTML</script>');
  assert.equal(page.nextCursor, 'page-2');
});

test('cwd grouping preserves separate projects with identical folder names and exact roots', () => {
  const make = (id, cwd, updatedAt) => ({ id, cwd, updatedAt, title: id });
  const groups = groupChats([
    make('thread-0001', '/company/app', 1), make('thread-0002', '/personal/app', 30),
    make('thread-0003', '/company/app', 20), make('thread-0004', '/company/app/packages/ui', 40),
  ], ['/company/app']);
  assert.equal(groups.length, 3);
  assert.equal(groups[0].cwd, '/company/app');
  assert.deepEqual(groups[0].chats.map(chat => chat.id), ['thread-0003', 'thread-0001']);
  assert.equal(groups.find(group => group.cwd.endsWith('/ui')).current, false);
  assert.equal(groups.filter(group => group.name === 'app').length, 2);
});

test('Windows paths normalize case and separators without changing POSIX path case', () => {
  assert.equal(pathKey('C:\\Repos\\App\\'), pathKey('c:/repos/app'));
  assert.equal(pathKey('\\\\Server\\Share\\App'), pathKey('\\\\server\\share\\app\\'));
  assert.notEqual(pathKey('/Projects/App'), pathKey('/projects/app'));
  assert.equal(uniquePaths(['/a/', '/a', '/b']).length, 2);
  assert.equal(pathKey('/'), '/');
});
