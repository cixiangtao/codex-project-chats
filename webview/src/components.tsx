import { useCallback, useLayoutEffect, useRef } from 'react';
import type { Chat, ProjectGroup as Group, Scope } from '../../src/model';
import type { ViewState, WebviewMessage } from '../../src/protocol';
import { useStrings } from './localization';
import type { Tooltip } from './tooltip';

type Send = (message: WebviewMessage) => void;

export function ScopeSwitcher({ scope, send }: { scope: Scope; send: Send }) {
  const { t } = useStrings();
  return <div className="scope" role="group" aria-label={t('scope')}>
    <button id="current" type="button" aria-pressed={scope === 'current'} onClick={() => send({ type: 'scope', value: 'current' })}>{t('current')}</button>
    <button id="all" type="button" aria-pressed={scope === 'all'} onClick={() => send({ type: 'scope', value: 'all' })}>{t('all')}</button>
  </div>;
}

export function SearchInput({ value, send }: { value: string; send: Send }) {
  const { t } = useStrings();
  const input = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  useLayoutEffect(() => {
    if (input.current && document.activeElement !== input.current && !composing.current) input.current.value = value;
  }, [value]);
  return <div className="search">
    <svg aria-hidden="true" viewBox="0 0 16 16"><circle cx="6.8" cy="6.8" r="4.3"/><path d="m10 10 3.5 3.5"/></svg>
    <input ref={input} id="search" type="search" maxLength={200} defaultValue={value} placeholder={t('search')} aria-label={t('search')} autoComplete="off"
      onCompositionStart={() => { composing.current = true; }}
      onCompositionEnd={event => { composing.current = false; send({ type: 'search', value: event.currentTarget.value }); }}
      onInput={event => { if (!composing.current) send({ type: 'search', value: event.currentTarget.value }); }}/>
  </div>;
}

export function Toolbar({ state, send }: { state: ViewState; send: Send }) {
  const { t } = useStrings();
  const count = (kind: 'projects' | 'loaded' | 'chats', value: number) => t(`${kind}${value === 1 ? 'One' : 'Other'}`, { count: value });
  return <div className="summary">
    <span id="summary" role="status" aria-live="polite">{state.busy ? t('reading') : `${count('projects', state.groups.length)} · ${count(state.hasMore ? 'loaded' : 'chats', state.count)}`}</span>
    <button id="refresh" className="icon" type="button" disabled={state.busy} title={t('refresh')} aria-label={t('refresh')} onClick={() => send({ type: 'refresh' })}>
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 5a5.4 5.4 0 1 0 .1 5M13 1.8V5H9.8"/></svg>
    </button>
  </div>;
}

interface RowProps {
  chat: Chat; opening: string | null; clock: number; tooltip: Tooltip; send: Send;
  formatTime: (seconds: number, clock: number) => string;
  register: (id: string, node: HTMLButtonElement | null) => void;
}
export function ConversationRow({ chat, opening, clock, formatTime, tooltip, send, register }: RowProps) {
  const { t } = useStrings();
  const bind = useCallback((node: HTMLButtonElement | null) => register(chat.id, node), [chat.id, register]);
  const active = opening === chat.id;
  const updated = formatTime(chat.updatedAt, clock);
  return <button ref={bind} type="button" className={`chat${active ? ' opening' : ''}`} data-id={chat.id} disabled={Boolean(opening)}
    aria-label={t(active ? 'openingLabel' : 'openLabel', { title: chat.title, time: updated })} aria-busy={active}
    aria-describedby={tooltip.target?.chat.id === chat.id ? 'chat-tooltip' : undefined}
    onPointerEnter={event => tooltip.enter(event.currentTarget, chat, chat.cwd)}
    onPointerLeave={event => { if (!event.currentTarget.matches(':focus-visible')) tooltip.leave(); }}
    onFocus={event => tooltip.focus(event.currentTarget, chat, chat.cwd)} onBlur={tooltip.leave}
    onClick={() => { tooltip.hide(); send({ type: 'open', id: chat.id }); }}>
    <span className="chat-body"><span className="chat-title">{chat.title}</span><span className="chat-time">{active ? t('opening') : updated}</span></span>
  </button>;
}

interface GroupProps extends Omit<RowProps, 'chat'> {
  group: Group; open: boolean; duplicate: boolean; searching: boolean;
  setOpen: (key: string, open: boolean) => void;
}
export function ProjectGroup({ group, open, duplicate, searching, setOpen, ...row }: GroupProps) {
  const { t } = useStrings();
  return <details data-key={group.key} open={open} onToggle={event => {
    const next = event.currentTarget.open;
    if (searching || next === open) return;
    row.tooltip.hide(); setOpen(group.key, next);
  }}>
    <summary title={group.cwd}>
      <svg className="chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>
      <span className="project-labels"><span className="project-name">{group.name}</span>{duplicate ? <span className="path" title={group.cwd}>{group.cwd}</span> : null}</span>
      {group.current ? <span className="current-label">{t('currentBadge')}</span> : null}<span className="count">{group.chats.length}</span>
    </summary>
    {group.chats.map(chat => <ConversationRow key={chat.id} chat={chat} {...row}/>) }
  </details>;
}

export function StatusArea({ state, send }: { state: ViewState; send: Send }) {
  const { t } = useStrings();
  const missing = state.scope === 'current' && !state.hasWorkspace;
  return <>
    <section id="empty" hidden={state.busy || Boolean(state.error) || state.count > 0}>
      <p id="empty-title">{t(missing ? 'emptyWorkspaceTitle' : state.search ? 'emptySearchTitle' : 'emptyTitle')}</p>
      <p id="empty-detail">{t(missing ? 'emptyWorkspaceDetail' : state.search ? 'emptySearchDetail' : state.scope === 'current' ? 'emptyCurrentDetail' : 'emptyAllDetail')}</p>
      <button id="empty-action" type="button" hidden={state.scope !== 'current'} onClick={() => send({ type: 'scope', value: 'all' })}>{t('viewAll')}</button>
    </section>
    <div id="error" role="alert" hidden={!state.error}><p id="error-text">{state.error}</p><button id="retry" type="button" onClick={() => send({ type: 'refresh' })}>{t('retry')}</button></div>
    <footer><button id="more" type="button" hidden={!state.hasMore || Boolean(state.error)} disabled={state.busy} onClick={() => send({ type: 'more' })}>{t(state.busy ? 'loading' : 'more')}</button><span id="footer">{state.count ? t('footer') : ''}</span></footer>
  </>;
}
