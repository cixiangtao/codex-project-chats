/* The webview is deliberately dependency-free and renders all thread metadata as text. */
(() => {
  const host = acquireVsCodeApi();
  const $ = id => document.getElementById(id);
  const previous = host.getState() || {};
  const collapsed = new Set(previous.collapsed || []);
  const expanded = new Set(previous.expanded || []);
  let lastState;
  let composing = false;
  const send = (type, rest = {}) => host.postMessage({ type, ...rest });
  const persist = () => host.setState({ collapsed: [...collapsed], expanded: [...expanded] });
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const icon = (kind, className = '') => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 16 16'); svg.setAttribute('aria-hidden', 'true');
    if (className) svg.setAttribute('class', className);
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', kind === 'chevron' ? 'm4 6 4 4 4-4' : 'M3 3h10v8H7l-4 2z');
    svg.append(p); return svg;
  };
  const timeLabel = seconds => {
    if (!seconds) return '时间未知';
    const minutes = Math.max(0, Math.floor((Date.now() - seconds * 1000) / 60000));
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    const date = new Date(seconds * 1000);
    const now = new Date();
    // Compare calendar days so yesterday stays yesterday across DST changes.
    const dayNumber = value => Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / 86400000;
    const days = dayNumber(now) - dayNumber(date);
    if (days === 0) return `${Math.floor(minutes / 60)}小时前`;
    if (days === 1) return '昨天';
    if (days < 7 && days > 1) return `${days}天前`;
    const monthDay = `${date.getMonth() + 1}/${date.getDate()}`;
    return date.getFullYear() === now.getFullYear() ? monthDay : `${String(date.getFullYear()).slice(-2)}/${monthDay}`;
  };
  const tooltip = element('div', 'chat-tooltip');
  tooltip.id = 'chat-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  document.body.append(tooltip);
  let tooltipAnchor;
  let tooltipTimer;
  let tooltipFocusFrame;
  const hideTooltip = () => {
    clearTimeout(tooltipTimer);
    cancelAnimationFrame(tooltipFocusFrame);
    tooltipFocusFrame = undefined;
    tooltip.hidden = true;
    tooltipAnchor?.removeAttribute('aria-describedby');
    tooltipAnchor = undefined;
  };
  const showTooltip = (button, chat, cwd) => {
    hideTooltip();
    if (!button.isConnected || button.disabled) return;
    const fields = element('dl', 'chat-tooltip-fields');
    const addField = (label, value, className) => {
      const field = element('div');
      field.append(element('dt', '', label), element('dd', className, value));
      fields.append(field);
    };
    const timestamp = chat.updatedAt ? new Date(chat.updatedAt * 1000).toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }) : '时间未知';
    addField('更新于', timestamp, 'chat-tooltip-date');
    addField('路径', cwd, 'chat-tooltip-path');
    tooltip.replaceChildren(element('p', 'chat-tooltip-title', chat.title), fields);
    tooltipAnchor = button;
    button.setAttribute('aria-describedby', tooltip.id);
    tooltip.style.maxHeight = '';
    tooltip.hidden = false;
    const anchor = button.getBoundingClientRect();
    const bounds = tooltip.getBoundingClientRect();
    // Keep the left side of the list clear for moving between conversation rows.
    tooltip.style.left = `${window.innerWidth - bounds.width - 12}px`;
    const above = anchor.top - 12;
    const below = window.innerHeight - anchor.bottom - 12;
    const placeAbove = bounds.height <= above || above >= below;
    tooltip.style.maxHeight = `${Math.max(0, Math.min(180, placeAbove ? above : below))}px`;
    const height = tooltip.getBoundingClientRect().height;
    tooltip.style.top = `${Math.max(8, placeAbove ? anchor.top - height - 4 : anchor.bottom + 4)}px`;
  };
  const delayHideTooltip = () => {
    clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(hideTooltip, 120);
  };
  tooltip.addEventListener('pointerenter', () => clearTimeout(tooltipTimer));
  tooltip.addEventListener('pointerleave', () => {
    if (!tooltipAnchor?.matches(':focus-visible')) delayHideTooltip();
  });
  window.addEventListener('keydown', event => { if (event.key === 'Escape') hideTooltip(); });
  window.addEventListener('scroll', event => {
    // Keyboard focus may scroll a row into view before its tooltip is positioned.
    if (tooltipFocusFrame) return;
    if (!(event.target instanceof Node) || !tooltip.contains(event.target)) hideTooltip();
  }, true);
  window.addEventListener('resize', hideTooltip);
  window.addEventListener('blur', hideTooltip);
  const render = state => {
    hideTooltip();
    const oldTop = window.scrollY;
    lastState = state;
    $('current').setAttribute('aria-pressed', String(state.scope === 'current'));
    $('all').setAttribute('aria-pressed', String(state.scope === 'all'));
    $('refresh').disabled = state.busy;
    if (document.activeElement !== $('search') && !composing) $('search').value = state.search;
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
      if (group.current) summary.append(element('span', 'current-label', '当前'));
      summary.append(element('span', 'count', String(group.chats.length)));
      details.append(summary);
      for (const chat of group.chats) {
        const button = element('button', 'chat'); button.type = 'button';
        button.dataset.id = chat.id;
        const opening = state.opening === chat.id;
        const updated = timeLabel(chat.updatedAt);
        button.setAttribute('aria-label', `${chat.title}，${opening ? '正在打开 Codex' : `最后更新：${updated}，在 Codex 中打开`}`);
        button.setAttribute('aria-busy', String(opening));
        button.disabled = Boolean(state.opening);
        if (opening) button.classList.add('opening');
        const body = element('span', 'chat-body');
        body.append(element('span', 'chat-title', chat.title), element('span', 'chat-time', opening ? '打开中…' : updated));
        button.append(body);
        button.addEventListener('pointerenter', () => {
          clearTimeout(tooltipTimer);
          tooltipTimer = setTimeout(() => showTooltip(button, chat, group.cwd), 350);
        });
        button.addEventListener('pointerleave', () => {
          if (!button.matches(':focus-visible')) delayHideTooltip();
        });
        button.addEventListener('focus', () => {
          hideTooltip();
          tooltipFocusFrame = requestAnimationFrame(() => {
            tooltipFocusFrame = undefined;
            if (document.activeElement === button) showTooltip(button, chat, group.cwd);
          });
        });
        button.addEventListener('blur', delayHideTooltip);
        button.addEventListener('click', () => { hideTooltip(); send('open', { id: chat.id }); });
        details.append(button);
      }
      details.addEventListener('toggle', () => {
        if (!details.isConnected || state.search) return;
        hideTooltip();
        if (details.open) { collapsed.delete(group.key); expanded.add(group.key); }
        else { collapsed.add(group.key); expanded.delete(group.key); }
        persist();
      });
      fragment.append(details);
    }
    $('groups').replaceChildren(fragment);
    $('summary').textContent = state.busy ? '正在读取对话…' : `${state.groups.length} 个项目 · ${state.count} 条${state.hasMore ? '已加载' : '对话'}`;
    const empty = !state.busy && !state.error && !state.count;
    $('empty').hidden = !empty;
    $('error').hidden = !state.error;
    $('error-text').textContent = state.error;
    const missingWorkspace = state.scope === 'current' && !state.hasWorkspace;
    $('empty-title').textContent = missingWorkspace ? '先打开一个项目文件夹' : state.search ? '没有匹配的对话' : '这里还没有对话';
    $('empty-detail').textContent = missingWorkspace ? '打开项目后自动显示相关对话，也可以先浏览全部项目。' : state.search ? '试试其他标题关键词，或清空搜索。' : state.scope === 'current' ? '只显示工作目录与当前项目根目录相同的对话。可切换全部项目查看其他目录。' : '使用官方 Codex 创建对话后，点击刷新。';
    $('empty-action').hidden = state.scope !== 'current';
    $('more').hidden = !state.hasMore || Boolean(state.error);
    $('more').disabled = state.busy;
    $('more').textContent = state.busy ? '正在加载…' : '加载更多对话';
    $('footer').textContent = state.count ? '点击对话，在官方 Codex 中继续' : '';
    window.scrollTo(0, oldTop);
  };
  $('current').addEventListener('click', () => send('scope', { value: 'current' }));
  $('all').addEventListener('click', () => send('scope', { value: 'all' }));
  $('empty-action').addEventListener('click', () => send('scope', { value: 'all' }));
  $('refresh').addEventListener('click', () => send('refresh'));
  $('retry').addEventListener('click', () => send('refresh'));
  $('more').addEventListener('click', () => send('more'));
  $('search').addEventListener('compositionstart', () => { composing = true; });
  $('search').addEventListener('compositionend', () => { composing = false; send('search', { value: $('search').value }); });
  $('search').addEventListener('input', () => { if (!composing) send('search', { value: $('search').value }); });
  window.addEventListener('message', event => { if (event.data?.type === 'state') render(event.data); });
  window.addEventListener('pageshow', () => { if (lastState) render(lastState); });
  send('ready');
})();
