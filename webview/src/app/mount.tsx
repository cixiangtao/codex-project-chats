import { createRoot } from 'react-dom/client';

import { LocalizationContext } from '../i18n/context';
import { readStrings } from '../i18n/readStrings';
import { App } from './App';

/** Mount one React root and acquire the private VS Code bridge exactly once. */
export function mount() {
  const container = document.getElementById('root');
  if (!container) throw new Error('Missing view root');
  const host = acquireVsCodeApi();
  const strings = readStrings();
  document.documentElement.lang = strings.locale;
  document.title = strings.t('viewTitle');
  const root = createRoot(container);
  root.render(
    <LocalizationContext.Provider value={strings}>
      <App host={host} />
    </LocalizationContext.Provider>,
  );
  return () => root.unmount();
}
