import { sampleGroups } from './sample.mts';
import type { ViewState } from '../../src/protocol';
import type { WebviewApi } from '../src/host/types';

// This entry belongs exclusively to local development and the standalone sample preview.
const locale = document.documentElement.lang;
const groups = sampleGroups(locale);
let saved: ReturnType<WebviewApi['getState']>;
let state: ViewState = {
  type: 'state', scope: 'current', search: '', groups: [], busy: false, opening: null,
  error: '', hasMore: false, count: 0, hasWorkspace: true,
};
globalThis.acquireVsCodeApi = () => ({
  getState: () => saved,
  setState: value => { saved = value; },
  postMessage: message => {
    if (message.type === 'scope') state = { ...state, scope: message.value };
    if (message.type === 'search') state = { ...state, search: message.value };
    if (message.type === 'open') {
      const footer = document.getElementById('footer');
      if (footer) footer.textContent = locale === 'zh-CN'
        ? '示例预览：实际安装后在官方 Codex 中打开' : 'Sample preview: installed extension opens official Codex';
      return;
    }
    const matches = groups.filter(group => state.scope === 'all' || group.current)
      .map(group => ({ ...group, chats: group.chats.filter(chat => chat.title.toLocaleLowerCase(locale).includes(state.search.toLocaleLowerCase(locale))) }))
      .filter(group => group.chats.length > 0);
    window.setTimeout(() => window.postMessage({ ...state, groups: matches, count: matches.reduce((count, group) => count + group.chats.length, 0) }, '*'), 20);
  },
});
