import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Chat } from '../../src/model';
import { useStrings } from './localization';

interface Target { button: HTMLButtonElement; chat: Chat; cwd: string }

/** Own one hover/focus target and cancel all delayed work when the view unmounts. */
export function useTooltip() {
  const [target, setTarget] = useState<Target | null>(null);
  const element = useRef<HTMLDivElement>(null);
  const anchor = useRef<HTMLButtonElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const frame = useRef<number | undefined>(undefined);
  const cancel = useCallback(() => {
    clearTimeout(timer.current);
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    frame.current = undefined;
  }, []);
  const hide = useCallback(() => { cancel(); anchor.current = null; setTarget(null); }, [cancel]);
  const show = useCallback((button: HTMLButtonElement, chat: Chat, cwd: string) => {
    cancel();
    if (!button.isConnected || button.disabled) return;
    anchor.current = button;
    setTarget({ button, chat, cwd });
  }, [cancel]);
  const enter = (button: HTMLButtonElement, chat: Chat, cwd: string) => {
    cancel(); timer.current = setTimeout(() => show(button, chat, cwd), 350);
  };
  const leave = () => { clearTimeout(timer.current); timer.current = setTimeout(hide, 120); };
  const focus = (button: HTMLButtonElement, chat: Chat, cwd: string) => {
    hide();
    frame.current = requestAnimationFrame(() => {
      frame.current = undefined;
      if (document.activeElement === button) show(button, chat, cwd);
    });
  };
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') hide(); };
    const scroll = (event: Event) => {
      if (frame.current !== undefined) return;
      if (!(event.target instanceof Node) || !element.current?.contains(event.target)) hide();
    };
    window.addEventListener('keydown', escape);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', hide);
    window.addEventListener('blur', hide);
    return () => {
      cancel();
      window.removeEventListener('keydown', escape);
      window.removeEventListener('scroll', scroll, true);
      window.removeEventListener('resize', hide);
      window.removeEventListener('blur', hide);
    };
  }, [hide, cancel]);
  return { target, element, anchor, hide, enter, leave, focus, cancel };
}
export type Tooltip = ReturnType<typeof useTooltip>;

export function ConversationTooltip({ tooltip }: { tooltip: Tooltip }) {
  const { locale, t } = useStrings();
  const { target, element } = tooltip;
  useLayoutEffect(() => {
    const node = element.current;
    if (!node || !target) return;
    // Measure before paint, preserving the left-side pointer lane and anchor clearance.
    node.style.maxHeight = '';
    const anchor = target.button.getBoundingClientRect();
    const bounds = node.getBoundingClientRect();
    const above = anchor.top - 12;
    const below = window.innerHeight - anchor.bottom - 12;
    const placeAbove = bounds.height <= above || above >= below;
    node.style.left = `${window.innerWidth - bounds.width - 12}px`;
    node.style.maxHeight = `${Math.max(0, Math.min(180, placeAbove ? above : below))}px`;
    const height = node.getBoundingClientRect().height;
    node.style.top = `${Math.max(8, placeAbove ? anchor.top - height - 4 : anchor.bottom + 4)}px`;
  }, [target, element]);
  const date = new Date((target?.chat.updatedAt ?? 0) * 1000);
  const timestamp = target && target.chat.updatedAt > 0 && Number.isFinite(date.getTime())
    ? date.toLocaleString(locale, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
    : t('unknownTime');
  return <div ref={element} id="chat-tooltip" role="tooltip" className="chat-tooltip" hidden={!target}
    onPointerEnter={tooltip.cancel} onPointerLeave={() => {
      if (!tooltip.anchor.current?.matches(':focus-visible')) tooltip.leave();
    }}>
    {target ? <>
      <p className="chat-tooltip-title">{target.chat.title}</p>
      <dl className="chat-tooltip-fields">
        <div><dt>{t('updated')}</dt><dd className="chat-tooltip-date">{timestamp}</dd></div>
        <div><dt>{t('path')}</dt><dd className="chat-tooltip-path">{target.cwd}</dd></div>
      </dl>
    </> : null}
  </div>;
}
