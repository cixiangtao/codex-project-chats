import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type * as vscode from 'vscode';
import type { ChatPage } from '../src/model';

const mocks = vi.hoisted(() => ({
  list: vi.fn<(roots: string[] | undefined, search: string, cursor: string | null) => Promise<ChatPage>>(),
  dispose: vi.fn(), construct: vi.fn(),
  register: vi.fn<(id: string, provider: vscode.WebviewViewProvider) => vscode.Disposable>(),
  readFile: vi.fn<(file: string) => Promise<string>>(),
  updateScope: vi.fn<(key: string, value: unknown) => Promise<void>>(),
}));
vi.mock('../src/client', () => ({ CodexClient: class {
  constructor(...args: unknown[]) { mocks.construct(...args); }
  list = mocks.list;
  dispose = mocks.dispose;
} }));
vi.mock('node:fs/promises', () => ({
  readFile: mocks.readFile, access: async () => {}, realpath: async (value: string) => value,
}));
vi.mock('vscode', () => ({
  env: { language: 'en' },
  Uri: { joinPath: () => ({ toString: () => 'fixture' }) },
  workspace: {
    workspaceFolders: [{ uri: { scheme: 'file', fsPath: '/fixture' } }],
    getConfiguration: () => ({ get: () => '/fixture/codex' }),
    onDidChangeWorkspaceFolders: () => ({ dispose() {} }),
    onDidChangeConfiguration: () => ({ dispose() {} }),
  },
  window: { registerWebviewViewProvider: mocks.register },
  commands: { registerCommand: () => ({ dispose() {} }) },
}));
import { activate } from '../src/extension';

class Signal<T> {
  private listeners = new Set<(value: T) => unknown>();
  listen = (listener: (value: T) => unknown) => {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  };
  fire(value: T) { for (const listener of this.listeners) listener(value); }
}
const disposables: vscode.Disposable[] = [];
const page = (id: string): ChatPage => ({ chats: [{ id, cwd: '/fixture', title: id, recencyAt: 1 }], nextCursor: null });

async function setup() {
  const context = {
    extensionPath: '/fixture', extensionUri: {}, extension: { packageJSON: { version: '3.2.1' } },
    subscriptions: disposables, workspaceState: { get: (_key: string, fallback: string) => fallback, update: mocks.updateScope },
  } as unknown as vscode.ExtensionContext;
  const api = activate(context);
  const provider = mocks.register.mock.calls.at(-1)?.[1];
  if (!provider) throw new Error('Provider was not registered');
  const messages = new Signal<unknown>();
  const closed = new Signal<void>();
  const visible = new Signal<void>();
  const postMessage = vi.fn();
  const view = {
    visible: true,
    webview: { onDidReceiveMessage: messages.listen, asWebviewUri: () => ({ toString: () => 'fixture' }), postMessage },
    onDidDispose: closed.listen, onDidChangeVisibility: visible.listen,
  } as unknown as vscode.WebviewView;
  await provider.resolveWebviewView(view, {} as vscode.WebviewViewResolveContext, {} as vscode.CancellationToken);
  const ready = async () => { messages.fire({ type: 'ready' }); await vi.advanceTimersByTimeAsync(0); };
  const setVisible = (value: boolean) => {
    Object.assign(view, { visible: value });
    visible.fire();
  };
  return { api, messages, closed, view, postMessage, ready, setVisible };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.list.mockReset().mockResolvedValue(page('thread-default'));
  mocks.readFile.mockReset().mockImplementation(async file => file.endsWith('manifest.json')
    ? JSON.stringify({ 'src/main.ts': { isEntry: true, file: 'assets/main.js', css: ['assets/style.css'] } })
    : '<html>{{LOCALIZATION}}</html>');
  mocks.register.mockReturnValue({ dispose() {} });
  mocks.updateScope.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  for (const disposable of disposables.splice(0)) disposable.dispose();
  vi.useRealTimers();
});

test('closing a view cancels search debounce and prevents later background refreshes', async () => {
  const fixture = await setup();
  await fixture.ready();
  expect(mocks.construct).toHaveBeenCalledWith('/fixture/codex', '3.2.1', 'en');
  fixture.messages.fire({ type: 'search', value: 'pending' });
  fixture.closed.fire();
  await vi.advanceTimersByTimeAsync(300);
  const refresh = disposables[0] as vscode.Disposable & { refresh(): Promise<void> };
  await refresh.refresh();
  expect(mocks.construct).toHaveBeenCalledOnce();
  expect(mocks.list).toHaveBeenCalledOnce();
  expect(mocks.dispose).toHaveBeenCalledOnce();
  expect(fixture.api.snapshot()).toMatchObject({ ready: false, busy: false });
});

test('a closed view ignores an outstanding response and cannot publish stale state', async () => {
  const response = Promise.withResolvers<ChatPage>();
  mocks.list.mockReturnValueOnce(response.promise);
  const fixture = await setup();
  await fixture.ready();
  expect(fixture.api.snapshot().busy).toBe(true);
  fixture.closed.fire();
  const sent = fixture.postMessage.mock.calls.length;
  response.resolve(page('thread-too-late'));
  await vi.advanceTimersByTimeAsync(0);
  expect(fixture.api.snapshot()).toMatchObject({ ready: false, busy: false, count: 0 });
  expect(fixture.postMessage).toHaveBeenCalledTimes(sent);
});

test('a slower old search cannot replace a newer result', async () => {
  const older = Promise.withResolvers<ChatPage>();
  mocks.list.mockReturnValueOnce(older.promise).mockResolvedValueOnce(page('thread-newer'));
  const fixture = await setup();
  await fixture.ready();
  fixture.messages.fire({ type: 'search', value: 'newer' });
  await vi.advanceTimersByTimeAsync(220);
  older.resolve(page('thread-older'));
  await vi.advanceTimersByTimeAsync(0);
  const state = fixture.postMessage.mock.calls.at(-1)?.[0];
  expect(state).toMatchObject({ search: 'newer', busy: false, count: 1, groups: [{ chats: [{ id: 'thread-newer' }] }] });
});

test('a failed older request cannot dispose the client serving a newer result', async () => {
  const older = Promise.withResolvers<ChatPage>();
  mocks.list.mockReturnValueOnce(older.promise).mockResolvedValueOnce(page('thread-newer'));
  const fixture = await setup();
  await fixture.ready();
  fixture.messages.fire({ type: 'search', value: 'newer' });
  await vi.advanceTimersByTimeAsync(220);
  older.reject(new Error('old failure'));
  await vi.advanceTimersByTimeAsync(0);
  expect(mocks.dispose).not.toHaveBeenCalled();
  expect(fixture.api.snapshot()).toMatchObject({ busy: false, count: 1, error: '' });
});

test('visible history updates automatically without clearing the existing list', async () => {
  const initial: ChatPage = { chats: [...page('thread-kept').chats, ...page('thread-removed').chats], nextCursor: null };
  const response = Promise.withResolvers<ChatPage>();
  mocks.list.mockResolvedValueOnce(initial).mockReturnValueOnce(response.promise);
  const fixture = await setup();
  await fixture.ready();
  const sent = fixture.postMessage.mock.calls.length;
  await vi.advanceTimersByTimeAsync(5_000);
  expect(mocks.list).toHaveBeenCalledTimes(2);
  expect(fixture.api.snapshot()).toMatchObject({ busy: false, count: 2 });
  expect(fixture.postMessage).toHaveBeenCalledTimes(sent);
  const kept = { id: 'thread-kept', cwd: '/fixture', title: 'Renamed conversation', recencyAt: 20 };
  response.resolve({ chats: [kept, ...page('thread-added').chats], nextCursor: null });
  await vi.advanceTimersByTimeAsync(0);
  expect(fixture.postMessage).toHaveBeenCalledTimes(sent + 1);
  expect(fixture.postMessage.mock.calls.at(-1)?.[0]).toMatchObject({
    busy: false, count: 2, groups: [{ chats: [kept, { id: 'thread-added' }] }],
  });
});

test('unchanged polling does not publish state or restart the list service', async () => {
  const fixture = await setup();
  await fixture.ready();
  const sent = fixture.postMessage.mock.calls.length;
  await vi.advanceTimersByTimeAsync(15_000);
  expect(mocks.list).toHaveBeenCalledTimes(4);
  expect(mocks.construct).toHaveBeenCalledOnce();
  expect(fixture.postMessage).toHaveBeenCalledTimes(sent);
});

test('polling waits for readiness, pauses while hidden, and catches up immediately when visible', async () => {
  const fixture = await setup();
  fixture.setVisible(false);
  fixture.setVisible(true);
  await vi.advanceTimersByTimeAsync(10_000);
  expect(mocks.list).not.toHaveBeenCalled();
  await fixture.ready();
  fixture.setVisible(false);
  await vi.advanceTimersByTimeAsync(10_000);
  expect(mocks.list).toHaveBeenCalledOnce();
  mocks.list.mockResolvedValueOnce(page('thread-returned'));
  fixture.setVisible(true);
  await vi.advanceTimersByTimeAsync(0);
  expect(mocks.list).toHaveBeenCalledTimes(2);
  expect(fixture.postMessage.mock.calls.at(-1)?.[0]).toMatchObject({ groups: [{ chats: [{ id: 'thread-returned' }] }] });
  await vi.advanceTimersByTimeAsync(5_000);
  expect(mocks.list).toHaveBeenCalledTimes(3);
  fixture.closed.fire();
  fixture.setVisible(false);
  fixture.setVisible(true);
  await vi.advanceTimersByTimeAsync(15_000);
  expect(mocks.list).toHaveBeenCalledTimes(3);
});

test('a slow foreground load and a slow poll never start overlapping polls', async () => {
  const initial = Promise.withResolvers<ChatPage>();
  const background = Promise.withResolvers<ChatPage>();
  mocks.list.mockReturnValueOnce(initial.promise).mockReturnValueOnce(background.promise);
  const fixture = await setup();
  await fixture.ready();
  await vi.advanceTimersByTimeAsync(15_000);
  expect(mocks.list).toHaveBeenCalledOnce();
  initial.resolve(page('thread-initial'));
  await vi.advanceTimersByTimeAsync(5_000);
  expect(mocks.list).toHaveBeenCalledTimes(2);
  fixture.setVisible(false);
  fixture.setVisible(true);
  await vi.advanceTimersByTimeAsync(15_000);
  expect(mocks.list).toHaveBeenCalledTimes(2);
  background.resolve(page('thread-background'));
  await vi.advanceTimersByTimeAsync(5_000);
  expect(mocks.list).toHaveBeenCalledTimes(3);
});

test('automatic refresh rebuilds all loaded pages atomically and keeps the new pagination cursor', async () => {
  const second = Promise.withResolvers<ChatPage>();
  mocks.list
    .mockResolvedValueOnce({ ...page('thread-old-first'), nextCursor: 'old-second' })
    .mockResolvedValueOnce({ ...page('thread-old-second'), nextCursor: 'old-third' })
    .mockResolvedValueOnce({ ...page('thread-new-first'), nextCursor: 'new-second' })
    .mockReturnValueOnce(second.promise);
  const fixture = await setup();
  await fixture.ready();
  fixture.messages.fire({ type: 'more' });
  await vi.advanceTimersByTimeAsync(0);
  const sent = fixture.postMessage.mock.calls.length;
  await vi.advanceTimersByTimeAsync(5_000);
  expect(mocks.list).toHaveBeenNthCalledWith(3, ['/fixture'], '', null);
  expect(mocks.list).toHaveBeenNthCalledWith(4, ['/fixture'], '', 'new-second');
  expect(fixture.api.snapshot()).toMatchObject({ busy: false, count: 2 });
  expect(fixture.postMessage).toHaveBeenCalledTimes(sent);
  second.resolve({ ...page('thread-new-second'), nextCursor: 'new-third' });
  await vi.advanceTimersByTimeAsync(0);
  expect(fixture.postMessage.mock.calls.at(-1)?.[0]).toMatchObject({
    hasMore: true, count: 2, groups: [{ chats: [{ id: 'thread-new-first' }, { id: 'thread-new-second' }] }],
  });
  fixture.messages.fire({ type: 'more' });
  await vi.advanceTimersByTimeAsync(0);
  expect(mocks.list).toHaveBeenLastCalledWith(['/fixture'], '', 'new-third');
});

test('a shorter refreshed history removes old pages and stops at the end of the new list', async () => {
  mocks.list
    .mockResolvedValueOnce({ ...page('thread-first'), nextCursor: 'second' })
    .mockResolvedValueOnce(page('thread-second'))
    .mockResolvedValueOnce(page('thread-only'));
  const fixture = await setup();
  await fixture.ready();
  fixture.messages.fire({ type: 'more' });
  await vi.advanceTimersByTimeAsync(5_000);
  expect(mocks.list).toHaveBeenCalledTimes(3);
  expect(fixture.postMessage.mock.calls.at(-1)?.[0]).toMatchObject({
    hasMore: false, count: 1, groups: [{ chats: [{ id: 'thread-only' }] }],
  });
});

test('a user pagination request supersedes a slow automatic refresh', async () => {
  const background = Promise.withResolvers<ChatPage>();
  mocks.list
    .mockResolvedValueOnce({ ...page('thread-first'), nextCursor: 'second' })
    .mockReturnValueOnce(background.promise)
    .mockResolvedValueOnce(page('thread-second'));
  const fixture = await setup();
  await fixture.ready();
  await vi.advanceTimersByTimeAsync(5_000);
  fixture.messages.fire({ type: 'more' });
  await vi.advanceTimersByTimeAsync(0);
  expect(mocks.list).toHaveBeenLastCalledWith(['/fixture'], '', 'second');
  const sent = fixture.postMessage.mock.calls.length;
  background.resolve(page('thread-stale'));
  await vi.advanceTimersByTimeAsync(0);
  expect(fixture.api.snapshot()).toMatchObject({ busy: false, count: 2 });
  expect(fixture.postMessage).toHaveBeenCalledTimes(sent);
});

test('polling cannot interrupt search debounce or overwrite the new search', async () => {
  const background = Promise.withResolvers<ChatPage>();
  mocks.list.mockResolvedValueOnce(page('thread-initial')).mockReturnValueOnce(background.promise)
    .mockResolvedValueOnce(page('thread-matching'));
  const fixture = await setup();
  await fixture.ready();
  await vi.advanceTimersByTimeAsync(5_000);
  fixture.messages.fire({ type: 'search', value: 'matching' });
  fixture.setVisible(false);
  fixture.setVisible(true);
  await vi.advanceTimersByTimeAsync(219);
  expect(mocks.list).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1);
  expect(mocks.list).toHaveBeenLastCalledWith(['/fixture'], 'matching', null);
  background.reject(new Error('stale background failure'));
  await vi.advanceTimersByTimeAsync(0);
  expect(mocks.dispose).not.toHaveBeenCalled();
  expect(fixture.postMessage.mock.calls.at(-1)?.[0]).toMatchObject({
    search: 'matching', error: '', groups: [{ chats: [{ id: 'thread-matching' }] }],
  });
  const calls = mocks.list.mock.calls.length;
  await vi.advanceTimersByTimeAsync(4_900);
  fixture.messages.fire({ type: 'search', value: 'next' });
  await vi.advanceTimersByTimeAsync(100);
  expect(mocks.list).toHaveBeenCalledTimes(calls);
  await vi.advanceTimersByTimeAsync(120);
  expect(mocks.list).toHaveBeenLastCalledWith(['/fixture'], 'next', null);
});

test('switching scope refreshes immediately without waiting for workspace preferences', async () => {
  const background = Promise.withResolvers<ChatPage>();
  const saved = Promise.withResolvers<void>();
  mocks.list.mockResolvedValueOnce(page('thread-current')).mockReturnValueOnce(background.promise)
    .mockResolvedValueOnce(page('thread-all'));
  mocks.updateScope.mockReturnValueOnce(saved.promise);
  const fixture = await setup();
  await fixture.ready();
  await vi.advanceTimersByTimeAsync(5_000);
  fixture.messages.fire({ type: 'scope', value: 'all' });
  await vi.advanceTimersByTimeAsync(0);
  expect(mocks.list).toHaveBeenLastCalledWith(undefined, '', null);
  expect(fixture.postMessage.mock.calls.at(-1)?.[0]).toMatchObject({
    scope: 'all', groups: [{ chats: [{ id: 'thread-all' }] }],
  });
  const sent = fixture.postMessage.mock.calls.length;
  background.resolve(page('thread-stale-current'));
  saved.resolve();
  await vi.advanceTimersByTimeAsync(0);
  expect(fixture.postMessage).toHaveBeenCalledTimes(sent);
  expect(mocks.list).toHaveBeenCalledTimes(3);
});

test('a failed background page preserves the entire list and retries on the next cycle', async () => {
  mocks.list
    .mockResolvedValueOnce({ ...page('thread-first'), nextCursor: 'second' })
    .mockResolvedValueOnce(page('thread-second'))
    .mockResolvedValueOnce({ ...page('thread-partial'), nextCursor: 'new-second' })
    .mockRejectedValueOnce(new Error('temporary failure'))
    .mockResolvedValueOnce(page('thread-recovered'));
  const fixture = await setup();
  await fixture.ready();
  fixture.messages.fire({ type: 'more' });
  await vi.advanceTimersByTimeAsync(5_000);
  expect(fixture.postMessage.mock.calls.at(-1)?.[0]).toMatchObject({
    busy: false, error: 'temporary failure', count: 2,
    groups: [{ chats: [{ id: 'thread-first' }, { id: 'thread-second' }] }],
  });
  expect(mocks.dispose).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(5_000);
  expect(mocks.construct).toHaveBeenCalledTimes(2);
  expect(mocks.list).toHaveBeenLastCalledWith(['/fixture'], '', null);
  expect(fixture.postMessage.mock.calls.at(-1)?.[0]).toMatchObject({
    error: '', count: 1, groups: [{ chats: [{ id: 'thread-recovered' }] }],
  });
});

test('closing during a poll prevents publication and does not schedule another poll', async () => {
  const background = Promise.withResolvers<ChatPage>();
  mocks.list.mockResolvedValueOnce(page('thread-initial')).mockReturnValueOnce(background.promise);
  const fixture = await setup();
  await fixture.ready();
  await vi.advanceTimersByTimeAsync(5_000);
  fixture.closed.fire();
  const sent = fixture.postMessage.mock.calls.length;
  background.resolve(page('thread-late'));
  await vi.advanceTimersByTimeAsync(15_000);
  expect(mocks.list).toHaveBeenCalledTimes(2);
  expect(fixture.postMessage).toHaveBeenCalledTimes(sent);
  expect(vi.getTimerCount()).toBe(0);
});

test('disposal while the HTML template is loading leaves the closed webview untouched', async () => {
  const template = Promise.withResolvers<string>();
  mocks.readFile.mockReturnValueOnce(template.promise);
  const pending = setup();
  await vi.advanceTimersByTimeAsync(0);
  disposables[0]?.dispose();
  template.resolve('<html>late</html>');
  const fixture = await pending;
  expect(fixture.view.webview.html).toBeUndefined();
  expect(mocks.construct).not.toHaveBeenCalled();
});

test('disposal while the Vite manifest is loading leaves the closed view untouched', async () => {
  const manifest = Promise.withResolvers<string>();
  mocks.readFile.mockImplementation(file => file.endsWith('manifest.json')
    ? manifest.promise : Promise.resolve('<html>{{LOCALIZATION}}</html>'));
  const pending = setup();
  await vi.advanceTimersByTimeAsync(0);
  disposables[0]?.dispose();
  manifest.resolve(JSON.stringify({ entry: { isEntry: true, file: 'main.js', css: ['style.css'] } }));
  const fixture = await pending;
  expect(fixture.view.webview.html).toBeUndefined();
  expect(mocks.construct).not.toHaveBeenCalled();
});
