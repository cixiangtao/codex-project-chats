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
    if (minutes < 1) return '刚刚更新';
    if (minutes < 60) return `${minutes} 分钟前`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)} 小时前`;
    if (minutes < 10080) return `${Math.floor(minutes / 1440)} 天前`;
    return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(new Date(seconds * 1000));
  };
  const render = state => {
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
        button.title = `${chat.title}\n${group.cwd}\n${chat.updatedAt ? new Date(chat.updatedAt * 1000).toLocaleString('zh-CN') : ''}`;
        button.setAttribute('aria-label', `${chat.title}，在 Codex 中打开`);
        button.disabled = Boolean(state.opening);
        if (state.opening === chat.id) button.classList.add('opening');
        const body = element('span', 'chat-body');
        body.append(element('span', 'chat-title', chat.title), element('span', 'chat-time', state.opening === chat.id ? '正在打开 Codex…' : timeLabel(chat.updatedAt)));
        button.append(icon('chat'), body); button.addEventListener('click', () => send('open', { id: chat.id }));
        details.append(button);
      }
      details.addEventListener('toggle', () => {
        if (!details.isConnected || state.search) return;
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
