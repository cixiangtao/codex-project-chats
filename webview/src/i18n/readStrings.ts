import type { Localize, localization } from '../../../src/i18n';
import type { Strings } from './context';

/** Read the host's inert translation catalog without bundling the host implementation. */
export function readStrings(): Strings {
  const node = document.getElementById('localization');
  const { locale, messages }: ReturnType<typeof localization> = JSON.parse(
    node?.textContent || '{}',
  );
  const t: Localize = (key, values = {}) =>
    messages[key].replace(/\{(\w+)\}/g, (placeholder: string, name: string) =>
      values[name] === undefined ? placeholder : String(values[name]),
    );
  return { locale, t };
}
