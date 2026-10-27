import type { ViewState } from '../../../../src/protocol';
import type { SendMessage } from '../../host/types';
import { useStrings } from '../../i18n/context';
export function StatusArea({ state, send }: { state: ViewState; send: SendMessage }) {
  const { t } = useStrings();
  const missing = state.scope === 'current' && !state.hasWorkspace;
  return (
    <>
      <section id="empty" hidden={state.busy || Boolean(state.error) || state.count > 0}>
        <p id="empty-title">
          {t(missing ? 'emptyWorkspaceTitle' : state.search ? 'emptySearchTitle' : 'emptyTitle')}
        </p>
        <p id="empty-detail">
          {t(
            missing
              ? 'emptyWorkspaceDetail'
              : state.search
                ? 'emptySearchDetail'
                : state.scope === 'current'
                  ? 'emptyCurrentDetail'
                  : 'emptyAllDetail',
          )}
        </p>
        <button
          id="empty-action"
          type="button"
          hidden={state.scope !== 'current'}
          onClick={() => send({ type: 'scope', value: 'all' })}
        >
          {t('viewAll')}
        </button>
      </section>
      <div id="error" role="alert" hidden={!state.error}>
        <p id="error-text">{state.error}</p>
        <button id="retry" type="button" onClick={() => send({ type: 'refresh' })}>
          {t('retry')}
        </button>
      </div>
      <footer>
        <button
          id="more"
          type="button"
          hidden={!state.hasMore || Boolean(state.error)}
          disabled={state.busy}
          onClick={() => send({ type: 'more' })}
        >
          {t(state.busy ? 'loading' : 'more')}
        </button>
        <span id="footer">{state.count ? t('footer') : ''}</span>
      </footer>
    </>
  );
}
