import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ViewState, WebviewMessage } from '../../src/protocol';
import { ProjectGroup, ScopeSwitcher, SearchInput, StatusArea, Toolbar } from './components';
import { useConversationFocus, useVisibleClock } from './hooks';
import { useStrings } from './localization';
import { ConversationTooltip, useTooltip } from './tooltip';
import { createTimeFormatter } from './time';

const initialState: ViewState = {
  type: 'state', scope: 'current', search: '', groups: [], busy: true, opening: null,
  error: '', hasMore: false, count: 0, hasWorkspace: true,
};

/** The host owns conversation data; React owns the presentation and local expansion state. */
export function App({ host }: { host: ProjectChatsWebviewApi }) {
  const { locale, t } = useStrings();
  const [state, setState] = useState(initialState);
  const [collapse, setCollapse] = useState(() => {
    const previous = host.getState();
    return { collapsed: previous?.collapsed ?? [], expanded: previous?.expanded ?? [] };
  });
  const tooltip = useTooltip();
  const { hide } = tooltip;
  const { register, remember } = useConversationFocus(state);
  const clock = useVisibleClock();
  const formatTime = useMemo(() => createTimeFormatter(locale, t), [locale, t]);
  const send = useCallback((message: WebviewMessage) => host.postMessage(message), [host]);
  useEffect(() => {
    const receive = (event: MessageEvent<ViewState>) => {
      if (event.data?.type !== 'state') return;
      remember(); hide(); setState(event.data);
    };
    window.addEventListener('message', receive);
    send({ type: 'ready' });
    return () => window.removeEventListener('message', receive);
  }, [send, remember, hide]);
  useEffect(() => { host.setState(collapse); }, [collapse, host]);
  const setOpen = (key: string, open: boolean) => setCollapse(previous => ({
    collapsed: open ? previous.collapsed.filter(value => value !== key) : [...new Set([...previous.collapsed, key])],
    expanded: open ? [...new Set([...previous.expanded, key])] : previous.expanded.filter(value => value !== key),
  }));
  const names = new Map<string, number>();
  for (const group of state.groups) names.set(group.name, (names.get(group.name) ?? 0) + 1);
  return <>
    <header><ScopeSwitcher scope={state.scope} send={send}/><SearchInput value={state.search} send={send}/><Toolbar state={state} send={send}/></header>
    <main id="groups" aria-label={t('groups')}>
      {state.groups.map(group => <ProjectGroup key={group.key} group={group}
        open={Boolean(state.search) || (!collapse.collapsed.includes(group.key) && (state.scope === 'current' || group.current || collapse.expanded.includes(group.key)))}
        duplicate={(names.get(group.name) ?? 0) > 1} searching={Boolean(state.search)} setOpen={setOpen}
        opening={state.opening} clock={clock} formatTime={formatTime} tooltip={tooltip} send={send} register={register}/>) }
    </main>
    <StatusArea state={state} send={send}/><ConversationTooltip tooltip={tooltip}/>
  </>;
}
