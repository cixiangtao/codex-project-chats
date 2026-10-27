import { useCallback, useEffect, useState } from 'react';

import type { ProjectGroup, Scope } from '../../../../src/model';
import type { ExpansionState, WebviewApi } from '../../host/types';

/** Recover usable preferences even when stored state predates the current schema. */
function readExpansionState(value: unknown): ExpansionState {
  const record = value && typeof value === 'object' ? value : {};
  const strings = (list: unknown): string[] =>
    Array.isArray(list)
      ? [...new Set(list.filter((item): item is string => typeof item === 'string'))]
      : [];
  return {
    collapsed: strings('collapsed' in record ? record.collapsed : undefined),
    expanded: strings('expanded' in record ? record.expanded : undefined),
  };
}

/** Search expands results temporarily without replacing the user's saved preferences. */
export function useProjectExpansion(host: WebviewApi) {
  const [preferences, setPreferences] = useState(() => readExpansionState(host.getState()));
  useEffect(() => {
    host.setState(preferences);
  }, [preferences, host]);
  const setOpen = useCallback(
    (key: string, open: boolean) =>
      setPreferences((previous) => ({
        collapsed: open
          ? previous.collapsed.filter((value) => value !== key)
          : [...new Set([...previous.collapsed, key])],
        expanded: open
          ? [...new Set([...previous.expanded, key])]
          : previous.expanded.filter((value) => value !== key),
      })),
    [],
  );
  const isOpen = (group: ProjectGroup, scope: Scope, searching: boolean) =>
    searching ||
    (!preferences.collapsed.includes(group.key) &&
      (scope === 'current' || group.current || preferences.expanded.includes(group.key)));
  return { isOpen, setOpen };
}
