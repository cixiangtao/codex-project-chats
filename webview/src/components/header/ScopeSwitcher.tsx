import type { Scope } from '../../../../src/model';
import type { SendMessage } from '../../host/types';
import { useStrings } from '../../i18n/context';
export function ScopeSwitcher({ scope, send }: { scope: Scope; send: SendMessage }) {
  const { t } = useStrings();
  return (
    <div className="scope" role="group" aria-label={t('scope')}>
      <button
        id="current"
        type="button"
        aria-pressed={scope === 'current'}
        onClick={() => send({ type: 'scope', value: 'current' })}
      >
        {t('current')}
      </button>
      <button
        id="all"
        type="button"
        aria-pressed={scope === 'all'}
        onClick={() => send({ type: 'scope', value: 'all' })}
      >
        {t('all')}
      </button>
    </div>
  );
}
