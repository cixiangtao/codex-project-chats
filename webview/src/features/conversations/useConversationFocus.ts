import { useCallback, useLayoutEffect, useRef } from 'react';

import type { ViewState } from '../../../../src/protocol';

/** Preserve row focus across temporary removal or disabling, while respecting other controls. */
export function useConversationFocus(state: ViewState) {
  const nodes = useRef(new Map<string, HTMLButtonElement>());
  const pending = useRef('');
  const scrollTop = useRef(0);
  const register = useCallback((id: string, node: HTMLButtonElement | null) => {
    if (node) nodes.current.set(id, node);
    else nodes.current.delete(id);
  }, []);
  const remember = useCallback(() => {
    const active = document.activeElement;
    if (active instanceof HTMLButtonElement && active.dataset.id)
      pending.current = active.dataset.id;
    else if (active !== document.body) pending.current = '';
    scrollTop.current = window.scrollY;
  }, []);
  useLayoutEffect(() => {
    const target = nodes.current.get(pending.current);
    const active = document.activeElement;
    // The user may have moved focus after the message arrived but before React committed it.
    if (
      active !== document.body &&
      !(active instanceof HTMLButtonElement && active.dataset.id === pending.current)
    ) {
      pending.current = '';
    } else if (target && !target.disabled) {
      target.focus({ preventScroll: true });
      pending.current = '';
    }
    window.scrollTo(0, scrollTop.current);
  }, [state]);
  return { register, remember };
}
