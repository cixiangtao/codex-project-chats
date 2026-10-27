import { createContext, useContext } from 'react';
import type { Localize, localization } from '../../src/i18n';

export interface Strings { locale: string; t: Localize }
export const LocalizationContext = createContext<Strings | null>(null);

export function useStrings(): Strings {
  const value = useContext(LocalizationContext);
  if (!value) throw new Error('Missing view localization');
  return value;
}

/** Read the host's inert translation catalog without bundling the host implementation. */
export function readStrings(): Strings {
  const node = document.getElementById('localization');
  const { locale, messages }: ReturnType<typeof localization> = JSON.parse(node?.textContent || '{}');
  const t: Localize = (key, values = {}) => messages[key].replace(/\{(\w+)\}/g,
    (placeholder: string, name: string) => values[name] === undefined ? placeholder : String(values[name]));
  return { locale, t };
}
