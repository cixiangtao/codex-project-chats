// @vitest-environment jsdom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { mount } from '../media/view.js';
import { serializeLocalization } from '../src/i18n';
import type { ViewState, WebviewMessage } from '../src/protocol';

const clock = new Date(2026, 9, 27, 10, 0).getTime();
const template = readFileSync(path.resolve('media/view.html'), 'utf8');
let dispose: () => void;
const postMessage = vi.fn<(message: WebviewMessage) => void>();
const setState = vi.fn();

function state(overrides: Partial<ViewState> = {}): ViewState {
  return {
    type: 'state', scope: 'current', search: '', busy: false, opening: null, error: '',
    hasMore: false, hasWorkspace: true, count: 1,
    groups: [{ key: '/fixture', cwd: '/fixture', name: 'fixture', current: true,
      chats: [{ id: 'thread-0001', title: 'Sample conversation', cwd: '/fixture', updatedAt: clock / 1000 - 40 }] }],
    ...overrides,
  };
}
function receive(value: ViewState) { window.dispatchEvent(new MessageEvent('message', { data: value })); }
function row() {
  const node = document.querySelector<HTMLButtonElement>('button.chat');
  if (!node) throw new Error('Expected a conversation row');
  return node;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(clock);
  vi.clearAllMocks();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.stubGlobal('acquireVsCodeApi', () => ({ getState: () => undefined, setState, postMessage }));
  document.body.innerHTML = template.replace('{{LOCALIZATION}}', serializeLocalization('en')).match(/<body>([\s\S]*)<\/body>/)?.[1] || '';
  dispose = mount();
});
afterEach(() => {
  dispose();
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test('busy and opening updates keep existing DOM rows, then restore keyboard focus', () => {
  receive(state());
  const original = row();
  original.focus();
  receive(state({ busy: true }));
  expect(row()).toBe(original);
  expect(document.activeElement).toBe(original);
  receive(state({ opening: 'thread-0001' }));
  expect(row()).toBe(original);
  expect(original.disabled).toBe(true);
  expect(original.getAttribute('aria-busy')).toBe('true');
  receive(state());
  expect(row()).toBe(original);
  expect(original.disabled).toBe(false);
  expect(document.activeElement).toBe(original);
});

test('a refresh restores the matching row after results change without stealing search focus', () => {
  receive(state());
  row().focus();
  receive(state({ groups: [], count: 0, busy: true }));
  const updated = state();
  updated.groups[0]!.chats[0]!.title = 'Updated title';
  receive(updated);
  expect(document.activeElement).toBe(row());
  const search = document.getElementById('search');
  search?.focus();
  receive(state());
  expect(document.activeElement).toBe(search);
});

test('hover details preserve long titles as text and Escape dismisses them', async () => {
  const title = 'x'.repeat(220) + '<script>literal</script> END';
  const value = state(); value.groups[0]!.chats[0]!.title = title;
  receive(value);
  await vi.advanceTimersByTimeAsync(0);
  row().dispatchEvent(new Event('pointerenter'));
  await vi.advanceTimersByTimeAsync(350);
  const tooltip = document.getElementById('chat-tooltip');
  expect(tooltip?.hidden).toBe(false);
  expect(tooltip?.querySelector('.chat-tooltip-title')?.textContent).toBe(title);
  expect(tooltip?.querySelector('script')).toBeNull();
  expect(row().getAttribute('aria-describedby')).toBe('chat-tooltip');
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  expect(tooltip?.hidden).toBe(true);
  expect(row().hasAttribute('aria-describedby')).toBe(false);
});

test('the visible clock updates row labels without replacing nodes or requesting history', async () => {
  receive(state());
  const original = row();
  expect(original.querySelector('.chat-time')?.textContent).toBe('Just now');
  await vi.advanceTimersByTimeAsync(60_000);
  expect(original.querySelector('.chat-time')?.textContent).toBe('1m ago');
  expect(original.getAttribute('aria-label')).toContain('1m ago');
  expect(row()).toBe(original);
  expect(postMessage.mock.calls).toEqual([[{ type: 'ready' }]]);
});

test('hidden views stop their clock and update immediately when visible again', async () => {
  receive(state());
  await vi.advanceTimersByTimeAsync(0);
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  document.dispatchEvent(new Event('visibilitychange'));
  expect(vi.getTimerCount()).toBe(0);
  vi.setSystemTime(clock + 3_600_000);
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  document.dispatchEvent(new Event('visibilitychange'));
  expect(row().querySelector('.chat-time')?.textContent).toBe('1h ago');
  expect(vi.getTimerCount()).toBe(1);
});

test('IME composition sends only committed search text', () => {
  const search = document.querySelector<HTMLInputElement>('#search')!;
  search.dispatchEvent(new CompositionEvent('compositionstart'));
  search.value = 'zhong'; search.dispatchEvent(new Event('input'));
  expect(postMessage).toHaveBeenCalledOnce();
  search.value = '中文'; search.dispatchEvent(new CompositionEvent('compositionend'));
  expect(postMessage).toHaveBeenLastCalledWith({ type: 'search', value: '中文' });
});

test('search expansion does not overwrite the saved project collapse state', async () => {
  receive(state());
  await vi.advanceTimersByTimeAsync(0);
  const details = document.querySelector('details')!;
  details.open = false;
  await vi.advanceTimersByTimeAsync(0);
  expect(setState).toHaveBeenLastCalledWith({ collapsed: ['/fixture'], expanded: [] });
  receive(state({ search: 'Sample' }));
  expect(document.querySelector('details')?.open).toBe(true);
  await vi.advanceTimersByTimeAsync(0);
  receive(state());
  expect(document.querySelector('details')?.open).toBe(false);
});

test('unmount removes message listeners, hover details, and pending clock work', async () => {
  receive(state());
  await vi.advanceTimersByTimeAsync(0);
  dispose();
  const before = document.getElementById('summary')?.textContent;
  receive(state({ count: 0, groups: [] }));
  expect(document.getElementById('summary')?.textContent).toBe(before);
  expect(document.getElementById('chat-tooltip')).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});


test('replaced row listeners are released and cannot send stale navigation', () => {
  receive(state());
  const previous = row();
  const updated = state(); updated.groups[0]!.chats[0]!.title = 'Changed result';
  receive(updated);
  previous.click();
  expect(postMessage.mock.calls).toEqual([[{ type: 'ready' }]]);
  row().click();
  expect(postMessage).toHaveBeenLastCalledWith({ type: 'open', id: 'thread-0001' });
});
