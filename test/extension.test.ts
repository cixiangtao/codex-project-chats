import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type * as vscode from 'vscode';
import type { ChatPage } from '../src/model';

const mocks = vi.hoisted(() => ({
  list: vi.fn<(roots: string[] | undefined, search: string, cursor: string | null) => Promise<ChatPage>>(),
  dispose: vi.fn(), construct: vi.fn(),
  register: vi.fn<(id: string, provider: vscode.WebviewViewProvider) => vscode.Disposable>(),
  readFile: vi.fn<(file: string) => Promise<string>>(),
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
const page = (id: string): ChatPage => ({ chats: [{ id, cwd: '/fixture', title: id, updatedAt: 1 }], nextCursor: null });

async function setup() {
  const context = {
    extensionPath: '/fixture', extensionUri: {}, extension: { packageJSON: { version: '3.2.1' } },
    subscriptions: disposables, workspaceState: { get: (_key: string, fallback: string) => fallback, update: async () => {} },
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
  return { api, messages, closed, view, postMessage, ready };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  mocks.list.mockReset().mockResolvedValue(page('thread-default'));
  mocks.readFile.mockReset().mockImplementation(async file => file.endsWith('manifest.json')
    ? JSON.stringify({ 'src/main.ts': { isEntry: true, file: 'assets/main.js', css: ['assets/style.css'] } })
    : '<html>{{LOCALIZATION}}</html>');
  mocks.register.mockReturnValue({ dispose() {} });
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
