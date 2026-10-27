import { createContext, useContext } from 'react';

import type { Localize } from '../../../src/i18n';

export interface Strings {
  locale: string;
  t: Localize;
}
export const LocalizationContext = createContext<Strings | null>(null);

export function useStrings(): Strings {
  const value = useContext(LocalizationContext);
  if (!value) throw new Error('Missing view localization');
  return value;
}
