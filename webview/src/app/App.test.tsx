import { readFileSync } from 'node:fs';
import path from 'node:path';

import { act } from 'react';
// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { serializeLocalization } from '../../../src/i18n';
import type { ViewState, WebviewMessage } from '../../../src/protocol';
import { mount } from './mount';

const clock = new Date(2026, 9, 27, 10, 0).getTime();
const template = readFileSync(path.resolve('webview/src/app/view.html'), 'utf8');
let dispose: () => void;
const postMessage = vi.fn<(message: WebviewMessage) => void>();
const setState = vi.fn();
const getState = vi.fn<() => unknown>();

function state(overrides: Partial<ViewState> = {}): ViewState {
  return {
    type: 'state',
    scope: 'current',
    search: '',
    busy: false,
    opening: null,
    error: '',
    hasMore: false,
    hasWorkspace: true,
    count: 1,
    groups: [
      {
        key: '/fixture',
        cwd: '/fixture',
        name: 'fixture',
        current: true,
        chats: [
          {
            id: 'thread-0001',
            title: 'Sample conversation',
            cwd: '/fixture',
            updatedAt: clock / 1000 - 40,
          },
        ],
      },
    ],
    ...overrides,
  };
}
async function interact(action: () => void) {
  await act(async () => {
    action();
  });
}
async function receive(value: ViewState) {
  await interact(() => window.dispatchEvent(new MessageEvent('message', { data: value })));
}
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}
function row() {
  const node = document.querySelector<HTMLButtonElement>('button.chat');
  if (!node) throw new Error('Expected a conversation row');
  return node;
}

beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.setSystemTime(clock);
  vi.clearAllMocks();
  getState.mockReturnValue(undefined);
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.stubGlobal('acquireVsCodeApi', () => ({ getState, setState, postMessage }));
  document.body.innerHTML =
    template
      .replace('{{LOCALIZATION}}', serializeLocalization('en'))
      .match(/<body>([\s\S]*)<\/body>/)?.[1] || '';
  await interact(() => {
    dispose = mount();
  });
});
afterEach(async () => {
  await interact(dispose);
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test('busy and opening updates keep existing DOM rows, then restore keyboard focus', async () => {
  await receive(state());
  const original = row();
  await interact(() => original.focus());
  await receive(state({ busy: true }));
  expect(row()).toBe(original);
  expect(document.activeElement).toBe(original);
  await receive(state({ opening: 'thread-0001' }));
  expect(row()).toBe(original);
  expect(original.disabled).toBe(true);
  expect(original.getAttribute('aria-busy')).toBe('true');
  await receive(state());
  expect(row()).toBe(original);
  expect(original.disabled).toBe(false);
  expect(document.activeElement).toBe(original);
});

test('a refresh restores the matching row after results change without stealing search focus', async () => {
  await receive(state());
  await interact(() => row().focus());
  await receive(state({ groups: [], count: 0, busy: true }));
  const updated = state();
  updated.groups[0]!.chats[0]!.title = 'Updated title';
  await receive(updated);
  expect(document.activeElement).toBe(row());
  const search = document.getElementById('search');
  await interact(() => search?.focus());
  await receive(state());
  expect(document.activeElement).toBe(search);
});

test('hover details preserve long titles as text and Escape dismisses them', async () => {
  const title = 'x'.repeat(220) + '<script>literal</script> END';
  const value = state();
  value.groups[0]!.chats[0]!.title = title;
  await receive(value);
  await advance(0);
  await interact(() => row().dispatchEvent(new Event('pointerover', { bubbles: true })));
  await advance(350);
  const tooltip = document.getElementById('chat-tooltip');
  expect(tooltip?.hidden).toBe(false);
  expect(tooltip?.querySelector('.chat-tooltip-title')?.textContent).toBe(title);
  expect(tooltip?.querySelector('script')).toBeNull();
  expect(row().getAttribute('aria-describedby')).toBe('chat-tooltip');
  await interact(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
  expect(tooltip?.hidden).toBe(true);
  expect(row().hasAttribute('aria-describedby')).toBe(false);
});

test('the visible clock updates row labels without replacing nodes or requesting history', async () => {
  await receive(state());
  const original = row();
  expect(original.querySelector('.chat-time')?.textContent).toBe('Just now');
  await advance(60_000);
  expect(original.querySelector('.chat-time')?.textContent).toBe('1m ago');
  expect(original.getAttribute('aria-label')).toContain('1m ago');
  expect(row()).toBe(original);
  expect(postMessage.mock.calls).toEqual([[{ type: 'ready' }]]);
});

test('hidden views stop their clock and update immediately when visible again', async () => {
  await receive(state());
  await advance(0);
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  await interact(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(vi.getTimerCount()).toBe(0);
  vi.setSystemTime(clock + 3_600_000);
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  await interact(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(row().querySelector('.chat-time')?.textContent).toBe('1h ago');
  expect(vi.getTimerCount()).toBe(1);
});

test('IME composition sends only committed search text', async () => {
  const search = document.querySelector<HTMLInputElement>('#search')!;
  await interact(() =>
    search.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })),
  );
  await interact(() => {
    search.value = 'zhong';
    search.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(postMessage).toHaveBeenCalledOnce();
  await interact(() => {
    search.value = '中文';
    search.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
  });
  expect(postMessage).toHaveBeenLastCalledWith({ type: 'search', value: '中文' });
});

test('search expansion does not overwrite the saved project collapse state', async () => {
  await receive(state());
  await advance(0);
  const details = document.querySelector('details')!;
  await interact(() => {
    details.open = false;
  });
  await advance(0);
  expect(setState).toHaveBeenLastCalledWith({ collapsed: ['/fixture'], expanded: [] });
  await receive(state({ search: 'Sample' }));
  expect(document.querySelector('details')?.open).toBe(true);
  await advance(0);
  await receive(state());
  expect(document.querySelector('details')?.open).toBe(false);
});

test('legacy saved preferences cannot prevent the list from rendering', async () => {
  await interact(dispose);
  getState.mockReturnValue({ collapsed: '/fixture', expanded: null });
  await interact(() => {
    dispose = mount();
  });
  await receive(state());
  expect(document.querySelector('details')?.open).toBe(true);
  expect(row().textContent).toContain('Sample conversation');
  expect(setState).toHaveBeenLastCalledWith({ collapsed: [], expanded: [] });
});

test('recreated views restore valid saved project preferences and discard invalid entries', async () => {
  await interact(dispose);
  getState.mockReturnValue({ collapsed: ['/fixture', null, '/fixture'], expanded: [42, '/other'] });
  await interact(() => {
    dispose = mount();
  });
  await receive(state());
  expect(document.querySelector('details')?.open).toBe(false);
  expect(setState).toHaveBeenLastCalledWith({ collapsed: ['/fixture'], expanded: ['/other'] });
});

test('unmount removes message listeners, hover details, and pending clock work', async () => {
  await receive(state());
  await advance(0);
  await interact(dispose);
  const before = document.getElementById('summary')?.textContent;
  await receive(state({ count: 0, groups: [] }));
  expect(document.getElementById('summary')?.textContent).toBe(before);
  expect(document.getElementById('chat-tooltip')).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});

test('replaced row listeners are released and cannot send stale navigation', async () => {
  await receive(state());
  const previous = row();
  const updated = state();
  updated.groups[0]!.chats[0]!.id = 'thread-0002';
  await receive(updated);
  expect(previous.isConnected).toBe(false);
  await interact(() => previous.click());
  expect(postMessage.mock.calls).toEqual([[{ type: 'ready' }]]);
  await interact(() => row().click());
  expect(postMessage).toHaveBeenLastCalledWith({ type: 'open', id: 'thread-0002' });
});

test('stable conversation keys preserve the focused node when titles and ordering change', async () => {
  const value = state();
  value.groups[0]!.chats.push({
    id: 'thread-0002',
    title: 'Another conversation',
    cwd: '/fixture',
    updatedAt: clock / 1000,
  });
  await receive(value);
  const original = row();
  await interact(() => original.focus());
  const updated = structuredClone(value);
  updated.groups[0]!.chats.reverse();
  updated.groups[0]!.chats[1]!.title = 'Renamed conversation';
  await receive(updated);
  expect(document.querySelectorAll('button.chat')[1]).toBe(original);
  expect(original.querySelector('.chat-title')?.textContent).toBe('Renamed conversation');
  expect(document.activeElement).toBe(original);
});

test('scope, pagination, and failure controls keep their host message contract', async () => {
  await receive(state({ hasMore: true }));
  await interact(() => document.getElementById('more')?.click());
  expect(postMessage).toHaveBeenLastCalledWith({ type: 'more' });
  await receive(state({ hasMore: true, error: 'Fixture failure' }));
  expect(document.getElementById('error')?.hidden).toBe(false);
  expect(document.getElementById('more')?.hidden).toBe(true);
  await interact(() => document.getElementById('retry')?.click());
  expect(postMessage).toHaveBeenLastCalledWith({ type: 'refresh' });
  await interact(() => document.getElementById('all')?.click());
  expect(postMessage).toHaveBeenLastCalledWith({ type: 'scope', value: 'all' });
  await receive(state({ scope: 'all', count: 0, groups: [] }));
  expect(document.getElementById('all')?.getAttribute('aria-pressed')).toBe('true');
  expect(document.getElementById('empty')?.hidden).toBe(false);
  expect(document.getElementById('empty-action')?.hidden).toBe(true);
});

test('React controls and hover details use the injected Chinese catalog', async () => {
  await interact(dispose);
  document.body.innerHTML =
    template
      .replace('{{LOCALIZATION}}', serializeLocalization('zh-CN'))
      .match(/<body>([\s\S]*)<\/body>/)?.[1] || '';
  await interact(() => {
    dispose = mount();
  });
  await receive(state());
  expect(document.documentElement.lang).toBe('zh-CN');
  expect(document.getElementById('current')?.textContent).toBe('当前项目');
  expect(document.querySelector('input')?.placeholder).toBe('搜索对话标题');
  await advance(0);
  await interact(() => row().dispatchEvent(new Event('pointerover', { bubbles: true })));
  await advance(350);
  expect(document.querySelector('#chat-tooltip dt')?.textContent).toBe('更新于');
});
