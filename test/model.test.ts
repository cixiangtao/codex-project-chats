import { test, expect } from 'vitest';
import { parsePage, groupChats, pathKey, uniquePaths, type Chat } from '../src/model';

test('protocol parser rejects a broken page and skips malformed thread records', () => {
  expect(() => parsePage({ data: null })).toThrow();
  const page = parsePage({ data: [
    { id: 'thread-0001', cwd: '/apps/a', name: '  修复\n登录 ', recencyAt: 10 },
    { id: 'bad/<script>', cwd: '/apps/a', preview: 'wrong' },
    { id: 'thread-0002', cwd: '/apps/b', name: null, preview: '<script>not HTML</script>', recencyAt: 20 },
    { id: 'thread-0003', preview: 'no cwd' },
  ], nextCursor: 'page-2' });
  expect(page.chats.map(chat => chat.title)).toEqual(['修复 登录', '<script>not HTML</script>']);
  expect(page.nextCursor).toBe('page-2');
});

test('cwd grouping preserves exact roots, distinct same-name projects, and recency order', () => {
  const make = (id: string, cwd: string, recencyAt: number): Chat => ({ id, cwd, recencyAt, title: id });
  const groups = groupChats([
    make('thread-0001', '/company/app', 1), make('thread-0002', '/personal/app', 30),
    make('thread-0003', '/company/app', 20), make('thread-0004', '/company/app/packages/ui', 40),
  ], ['/company/app']);
  expect(groups).toHaveLength(3);
  expect(groups[0]).toMatchObject({ cwd: '/company/app', current: true });
  expect(groups[0]?.chats.map(chat => chat.id)).toEqual(['thread-0003', 'thread-0001']);
  expect(groups.find(group => group.cwd.endsWith('/ui'))?.current).toBe(false);
  expect(groups.filter(group => group.name === 'app')).toHaveLength(2);
});

test('settings updates cannot change displayed recency or conversation/project ordering', () => {
  const { chats } = parsePage({ data: [
    { id: 'thread-old-a', cwd: '/apps/a', recencyAt: 10, updatedAt: 900 },
    { id: 'thread-new-a', cwd: '/apps/a', recencyAt: 20, updatedAt: 20 },
    { id: 'thread-new-b', cwd: '/apps/b', recencyAt: 30, updatedAt: 30 },
  ] });
  expect(chats[0]?.recencyAt).toBe(10);
  expect(chats[0]).not.toHaveProperty('updatedAt');
  const groups = groupChats(chats, []);
  expect(groups.map(group => group.cwd)).toEqual(['/apps/b', '/apps/a']);
  expect(groups[1]?.chats.map(chat => chat.id)).toEqual(['thread-new-a', 'thread-old-a']);
});

test.each([undefined, null, 0, -1, NaN, Infinity, '123'])(
  'invalid recency %s stays unknown instead of falling back to a settings update', recencyAt => {
    const { chats } = parsePage({ data: [
      { id: 'thread-unknown', cwd: '/apps/a', recencyAt, updatedAt: 900 },
    ] });
    expect(chats[0]?.recencyAt).toBe(0);
  },
);

test('Windows paths normalize case and separators without changing POSIX path case', () => {
  expect(pathKey('C:\\Repos\\App\\')).toBe(pathKey('c:/repos/app'));
  expect(pathKey('\\\\Server\\Share\\App')).toBe(pathKey('\\\\server\\share\\app\\'));
  expect(pathKey('/Projects/App')).not.toBe(pathKey('/projects/app'));
  expect(uniquePaths(['/a/', '/a', '/b'])).toHaveLength(2);
  expect(pathKey('/')).toBe('/');
});


test('protocol parsing preserves the full title for hover details', () => {
  const title = 'x'.repeat(220) + ' END';
  const page = parsePage({ data: [{ id: 'thread-0001', cwd: '/fixture', name: title }] });
  expect(page.chats[0]?.title).toBe(title);
});
