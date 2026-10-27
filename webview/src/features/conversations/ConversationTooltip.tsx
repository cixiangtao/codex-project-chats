import { useStrings } from '../../i18n/context';
import type { Tooltip } from './useTooltip';

export function ConversationTooltip({ tooltip }: { tooltip: Tooltip }) {
  const { locale, t } = useStrings();
  const { target, element } = tooltip;
  const date = new Date((target?.chat.updatedAt ?? 0) * 1000);
  const timestamp =
    target && target.chat.updatedAt > 0 && Number.isFinite(date.getTime())
      ? date.toLocaleString(locale, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      : t('unknownTime');
  return (
    <div
      ref={element}
      id="chat-tooltip"
      role="tooltip"
      className="chat-tooltip"
      hidden={!target}
      onPointerEnter={tooltip.cancel}
      onPointerLeave={() => {
        if (!tooltip.anchor.current?.matches(':focus-visible')) tooltip.leave();
      }}
    >
      {target ? (
        <>
          <p className="chat-tooltip-title">{target.chat.title}</p>
          <dl className="chat-tooltip-fields">
            <div>
              <dt>{t('updated')}</dt>
              <dd className="chat-tooltip-date">{timestamp}</dd>
            </div>
            <div>
              <dt>{t('path')}</dt>
              <dd className="chat-tooltip-path">{target.cwd}</dd>
            </div>
          </dl>
        </>
      ) : null}
    </div>
  );
}
