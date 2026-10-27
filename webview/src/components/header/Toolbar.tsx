import type { ViewState } from '../../../../src/protocol';
import type { SendMessage } from '../../host/types';
import { useStrings } from '../../i18n/context';
export function Toolbar({ state, send }: { state: ViewState; send: SendMessage }) {
  const { t } = useStrings();
  const count = (kind: 'projects' | 'loaded' | 'chats', value: number) =>
    t(`${kind}${value === 1 ? 'One' : 'Other'}`, { count: value });
  return (
    <div className="summary">
      <span id="summary" role="status" aria-live="polite">
        {state.busy
          ? t('reading')
          : `${count('projects', state.groups.length)} · ${count(state.hasMore ? 'loaded' : 'chats', state.count)}`}
      </span>
      <button
        id="refresh"
        className="icon"
        type="button"
        disabled={state.busy}
        title={t('refresh')}
        aria-label={t('refresh')}
        onClick={() => send({ type: 'refresh' })}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M13 5a5.4 5.4 0 1 0 .1 5M13 1.8V5H9.8" />
        </svg>
      </button>
    </div>
  );
}
