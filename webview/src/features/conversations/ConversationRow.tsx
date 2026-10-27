import { useCallback } from 'react';

import type { Chat } from '../../../../src/model';
import type { SendMessage } from '../../host/types';
import { useStrings } from '../../i18n/context';
import type { Tooltip } from './useTooltip';

export interface ConversationRowProps {
  chat: Chat;
  opening: string | null;
  clock: number;
  tooltip: Tooltip;
  send: SendMessage;
  formatTime: (seconds: number, clock: number) => string;
  register: (id: string, node: HTMLButtonElement | null) => void;
}
export function ConversationRow({
  chat,
  opening,
  clock,
  formatTime,
  tooltip,
  send,
  register,
}: ConversationRowProps) {
  const { t } = useStrings();
  const bind = useCallback(
    (node: HTMLButtonElement | null) => register(chat.id, node),
    [chat.id, register],
  );
  const active = opening === chat.id;
  const updated = formatTime(chat.updatedAt, clock);
  return (
    <button
      ref={bind}
      type="button"
      className={`chat${active ? ' opening' : ''}`}
      data-id={chat.id}
      disabled={Boolean(opening)}
      aria-label={t(active ? 'openingLabel' : 'openLabel', { title: chat.title, time: updated })}
      aria-busy={active}
      aria-describedby={tooltip.target?.chat.id === chat.id ? 'chat-tooltip' : undefined}
      onPointerEnter={(event) => tooltip.enter(event.currentTarget, chat, chat.cwd)}
      onPointerLeave={(event) => {
        if (!event.currentTarget.matches(':focus-visible')) tooltip.leave();
      }}
      onFocus={(event) => tooltip.focus(event.currentTarget, chat, chat.cwd)}
      onBlur={tooltip.leave}
      onClick={() => {
        tooltip.hide();
        send({ type: 'open', id: chat.id });
      }}
    >
      <span className="chat-body">
        <span className="chat-title">{chat.title}</span>
        <span className="chat-time">{active ? t('opening') : updated}</span>
      </span>
    </button>
  );
}
