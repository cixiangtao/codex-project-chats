import { createTimeFormatter } from './time.js';
import { createTooltip } from './tooltip.js';

/** Mount one local view. The returned cleanup owns listeners, timers, and hover details. */
export function mount() {
  const controller = new AbortController();
  const { signal } = controller;
  const host = acquireVsCodeApi();
  /** @param {string} id */
  const $ = id => {
    const node = document.getElementById(id);
    if (!node) throw new Error(`Missing view element: ${id}`);
    return node;
  };
  /** @param {string} id */
  const button = id => {
    const node = $(id);
    if (!(node instanceof HTMLButtonElement)) throw new Error(`Expected button: ${id}`);
    return node;
  };
  const search = $('search');
  if (!(search instanceof HTMLInputElement)) throw new Error('Missing search input');
  /** @type {ReturnType<typeof import('../src/i18n').localization>} */
  const { locale, messages } = JSON.parse($('localization').textContent || '{}');
  /** @type {import('../src/i18n').Localize} */
  const t = (key, values = {}) => messages[key].replace(/\{(\w+)\}/g,
    (placeholder, name) => values[name] === undefined ? placeholder : String(values[name]));
  document.documentElement.lang = locale;
  document.title = t('viewTitle');
  for (const node of document.querySelectorAll('[data-i18n]')) {
    const key = node.getAttribute('data-i18n');
    if (key && key in messages) node.textContent = t(/** @type {import('../src/i18n').MessageKey} */ (key));
  }
  for (const attribute of ['aria-label', 'placeholder', 'title']) {
    for (const node of document.querySelectorAll(`[data-i18n-${attribute}]`)) {
      const key = node.getAttribute(`data-i18n-${attribute}`);
      if (key && key in messages) node.setAttribute(attribute, t(/** @type {import('../src/i18n').MessageKey} */ (key)));
    }
  }
  /** @param {'projects' | 'loaded' | 'chats'} kind @param {number} count */
  const countLabel = (kind, count) => t(`${kind}${count === 1 ? 'One' : 'Other'}`, { count });
  const previous = host.getState() || {};
  const collapsed = new Set(previous.collapsed || []);
  const expanded = new Set(previous.expanded || []);
  /** @type {import('../src/protocol').ViewState | undefined} */
  let lastState;
  let renderedGroups = '';
  let rowsController = new AbortController();
  let focusId = '';
  /** @type {ReturnType<typeof setInterval> | undefined} */
  let clockTimer;
  let composing = false;
  /** @param {import('../src/protocol').WebviewMessage} message */
  const send = message => host.postMessage(message);
  const persist = () => host.setState({ collapsed: [...collapsed], expanded: [...expanded] });
  /** @template {keyof HTMLElementTagNameMap} K @param {K} tag @param {string} [className] @param {string} [text] */
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  /** @param {string} kind @param {string} [className] */
  const icon = (kind, className = '') => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 16 16'); svg.setAttribute('aria-hidden', 'true');
    if (className) svg.setAttribute('class', className);
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', kind === 'chevron' ? 'm4 6 4 4 4-4' : 'M3 3h10v8H7l-4 2z');
    svg.append(p); return svg;
  };
  const timeLabel = createTimeFormatter(locale, t);
  const tooltip = createTooltip(locale, t);
  const updateRows = () => {
    if (!lastState) return;
    const chats = new Map(lastState.groups.flatMap(group => group.chats.map(chat => [chat.id, chat])));
    const clock = Date.now();
    for (const node of document.querySelectorAll('button.chat')) {
      if (!(node instanceof HTMLButtonElement)) continue;
      const chat = chats.get(node.dataset.id || '');
      if (!chat) continue;
      const opening = lastState.opening === chat.id;
      node.disabled = Boolean(lastState.opening);
      node.classList.toggle('opening', opening);
      node.setAttribute('aria-busy', String(opening));
      const updated = timeLabel(chat.updatedAt, clock);
      node.setAttribute('aria-label', t(opening ? 'openingLabel' : 'openLabel', { title: chat.title, time: updated }));
      const time = node.querySelector('.chat-time');
      if (time) time.textContent = opening ? t('opening') : updated;
    }
  };
  const scheduleClock = () => {
    clearInterval(clockTimer);
    if (!document.hidden) {
      updateRows();
      clockTimer = setInterval(updateRows, 60_000);
    }
  };
  document.addEventListener('visibilitychange', scheduleClock, { signal });
  scheduleClock();
  /** @param {import('../src/protocol').ViewState} state */
  const render = state => {
    tooltip.hide();
    const oldTop = window.scrollY;
    lastState = state;
    $('current').setAttribute('aria-pressed', String(state.scope === 'current'));
    $('all').setAttribute('aria-pressed', String(state.scope === 'all'));
    button('refresh').disabled = state.busy;
    if (document.activeElement !== search && !composing) search.value = state.search;
    const active = document.activeElement;
    if (active instanceof HTMLButtonElement && active.dataset.id) focusId = active.dataset.id;
    else if (active !== document.body) focusId = '';
    const groupKey = JSON.stringify([state.scope, state.search, state.groups]);
    if (groupKey !== renderedGroups) {
      rowsController.abort();
      rowsController = new AbortController();
      const rowSignal = rowsController.signal;
      const names = new Map();
      for (const group of state.groups) names.set(group.name, (names.get(group.name) || 0) + 1);
      const fragment = document.createDocumentFragment();
      for (const group of state.groups) {
        const details = element('details');
        details.dataset.key = group.key;
        details.open = Boolean(state.search) || (!collapsed.has(group.key) && (state.scope === 'current' || group.current || expanded.has(group.key)));
        const summary = element('summary'); summary.title = group.cwd;
        const labels = element('span', 'project-labels');
        labels.append(element('span', 'project-name', group.name));
        if (names.get(group.name) > 1) {
          const directory = element('span', 'path', group.cwd); directory.title = group.cwd; labels.append(directory);
        }
        summary.append(icon('chevron', 'chevron'), labels);
        if (group.current) summary.append(element('span', 'current-label', t('currentBadge')));
        summary.append(element('span', 'count', String(group.chats.length)));
        details.append(summary);
        for (const chat of group.chats) {
          const button = element('button', 'chat'); button.type = 'button';
          button.dataset.id = chat.id;
          const body = element('span', 'chat-body');
          body.append(element('span', 'chat-title', chat.title), element('span', 'chat-time'));
          button.append(body);
          tooltip.bind(button, chat, group.cwd, rowSignal);
          button.addEventListener('click', () => { tooltip.hide(); send({ type: 'open', id: chat.id }); }, { signal: rowSignal });
          details.append(button);
        }
        details.addEventListener('toggle', () => {
          if (!details.isConnected || state.search) return;
          tooltip.hide();
          if (details.open) { collapsed.delete(group.key); expanded.add(group.key); }
          else { collapsed.add(group.key); expanded.delete(group.key); }
          persist();
        }, { signal: rowSignal });
        fragment.append(details);
      }
      $('groups').replaceChildren(fragment);
      renderedGroups = groupKey;
    }
    updateRows();
    if (focusId) {
      const target = [...document.querySelectorAll('button.chat')].find(node => node instanceof HTMLButtonElement && node.dataset.id === focusId);
      if (target instanceof HTMLButtonElement && !target.disabled) {
        target.focus({ preventScroll: true });
        focusId = '';
      }
    }
    $('summary').textContent = state.busy ? t('reading') : `${countLabel('projects', state.groups.length)} · ${countLabel(state.hasMore ? 'loaded' : 'chats', state.count)}`;
    const empty = !state.busy && !state.error && !state.count;
    $('empty').hidden = !empty;
    $('error').hidden = !state.error;
    $('error-text').textContent = state.error;
    const missingWorkspace = state.scope === 'current' && !state.hasWorkspace;
    $('empty-title').textContent = t(missingWorkspace ? 'emptyWorkspaceTitle' : state.search ? 'emptySearchTitle' : 'emptyTitle');
    $('empty-detail').textContent = t(missingWorkspace ? 'emptyWorkspaceDetail' : state.search ? 'emptySearchDetail' : state.scope === 'current' ? 'emptyCurrentDetail' : 'emptyAllDetail');
    $('empty-action').hidden = state.scope !== 'current';
    $('more').hidden = !state.hasMore || Boolean(state.error);
    button('more').disabled = state.busy;
    $('more').textContent = t(state.busy ? 'loading' : 'more');
    $('footer').textContent = state.count ? t('footer') : '';
    window.scrollTo(0, oldTop);
  };
  $('current').addEventListener('click', () => send({ type: 'scope', value: 'current' }), { signal });
  $('all').addEventListener('click', () => send({ type: 'scope', value: 'all' }), { signal });
  $('empty-action').addEventListener('click', () => send({ type: 'scope', value: 'all' }), { signal });
  $('refresh').addEventListener('click', () => send({ type: 'refresh' }), { signal });
  $('retry').addEventListener('click', () => send({ type: 'refresh' }), { signal });
  $('more').addEventListener('click', () => send({ type: 'more' }), { signal });
  search.addEventListener('compositionstart', () => { composing = true; }, { signal });
  search.addEventListener('compositionend', () => { composing = false; send({ type: 'search', value: search.value }); }, { signal });
  search.addEventListener('input', () => { if (!composing) send({ type: 'search', value: search.value }); }, { signal });
  /** @param {MessageEvent<import('../src/protocol').ViewState>} event */
  const receive = event => { if (event.data?.type === 'state') render(event.data); };
  window.addEventListener('message', receive, { signal });
  window.addEventListener('pageshow', () => { if (lastState) render(lastState); }, { signal });
  send({ type: 'ready' });
  return () => { controller.abort(); rowsController.abort(); clearInterval(clockTimer); tooltip.dispose(); };
}
