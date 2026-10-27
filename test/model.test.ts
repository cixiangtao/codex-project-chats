import { test, expect } from 'vitest';
import { parsePage, groupChats, pathKey, uniquePaths, type Chat } from '../src/model';

test('protocol parser rejects a broken page and skips malformed thread records', () => {
  expect(() => parsePage({ data: null })).toThrow();
  const page = parsePage({ data: [
    { id: 'thread-0001', cwd: '/apps/a', name: '  修复\n登录 ', updatedAt: 10 },
    { id: 'bad/<script>', cwd: '/apps/a', preview: 'wrong' },
    { id: 'thread-0002', cwd: '/apps/b', name: null, preview: '<script>not HTML</script>', updatedAt: 20 },
    { id: 'thread-0003', preview: 'no cwd' },
  ], nextCursor: 'page-2' });
  expect(page.chats.map(chat => chat.title)).toEqual(['修复 登录', '<script>not HTML</script>']);
  expect(page.nextCursor).toBe('page-2');
});

test('cwd grouping preserves exact roots, distinct same-name projects, and update order', () => {
  const make = (id: string, cwd: string, updatedAt: number): Chat => ({ id, cwd, updatedAt, title: id });
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

test('Windows paths normalize case and separators without changing POSIX path case', () => {
  expect(pathKey('C:\\Repos\\App\\')).toBe(pathKey('c:/repos/app'));
  expect(pathKey('\\\\Server\\Share\\App')).toBe(pathKey('\\\\server\\share\\app\\'));
  expect(pathKey('/Projects/App')).not.toBe(pathKey('/projects/app'));
  expect(uniquePaths(['/a/', '/a', '/b'])).toHaveLength(2);
  expect(pathKey('/')).toBe('/');
});
