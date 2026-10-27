import type { Localize } from '../../src/i18n';
import type { Chat } from '../../src/model';

/** Own the floating details element, its timers, and its window listeners. */
export function createTooltip(locale: string, t: Localize) {
  const controller = new AbortController();
  const { signal } = controller;
  const tooltip = document.createElement('div');
  tooltip.className = 'chat-tooltip';
  tooltip.id = 'chat-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  document.body.append(tooltip);
  let tooltipAnchor: HTMLButtonElement | undefined;
  let tooltipTimer: ReturnType<typeof setTimeout> | undefined;
  let tooltipFocusFrame: number | undefined;
  const hideTooltip = () => {
    clearTimeout(tooltipTimer);
    if (tooltipFocusFrame !== undefined) cancelAnimationFrame(tooltipFocusFrame);
    tooltipFocusFrame = undefined;
    tooltip.hidden = true;
    tooltipAnchor?.removeAttribute('aria-describedby');
    tooltipAnchor = undefined;
  };
  const showTooltip = (button: HTMLButtonElement, chat: Chat, cwd: string) => {
    hideTooltip();
    if (!button.isConnected || button.disabled) return;
    const fields = document.createElement('dl');
    fields.className = 'chat-tooltip-fields';
    const addField = (label: string, value: string, className: string) => {
      const field = document.createElement('div');
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = label; description.textContent = value; description.className = className;
      field.append(term, description);
      fields.append(field);
    };
    const date = new Date(chat.updatedAt * 1000);
    const timestamp = chat.updatedAt > 0 && Number.isFinite(date.getTime()) ? date.toLocaleString(locale, {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }) : t('unknownTime');
    addField(t('updated'), timestamp, 'chat-tooltip-date');
    addField(t('path'), cwd, 'chat-tooltip-path');
    const title = document.createElement('p');
    title.className = 'chat-tooltip-title'; title.textContent = chat.title;
    tooltip.replaceChildren(title, fields);
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
  window.addEventListener('keydown', event => { if (event.key === 'Escape') hideTooltip(); }, { signal });
  window.addEventListener('scroll', event => {
    // Keyboard focus may scroll a row into view before its tooltip is positioned.
    if (tooltipFocusFrame) return;
    if (!(event.target instanceof Node) || !tooltip.contains(event.target)) hideTooltip();
  }, { capture: true, signal });
  window.addEventListener('resize', hideTooltip, { signal });
  window.addEventListener('blur', hideTooltip, { signal });

  const bind = (button: HTMLButtonElement, chat: Chat, cwd: string, rowSignal: AbortSignal) => {
    button.addEventListener('pointerenter', () => {
      clearTimeout(tooltipTimer);
      tooltipTimer = setTimeout(() => showTooltip(button, chat, cwd), 350);
    }, { signal: rowSignal });
    button.addEventListener('pointerleave', () => {
      if (!button.matches(':focus-visible')) delayHideTooltip();
    }, { signal: rowSignal });
    button.addEventListener('focus', () => {
      hideTooltip();
      tooltipFocusFrame = requestAnimationFrame(() => {
        tooltipFocusFrame = undefined;
        if (document.activeElement === button) showTooltip(button, chat, cwd);
      });
    }, { signal: rowSignal });
    button.addEventListener('blur', delayHideTooltip, { signal: rowSignal });
  };
  return { hide: hideTooltip, bind, dispose() { controller.abort(); hideTooltip(); tooltip.remove(); } };
}
