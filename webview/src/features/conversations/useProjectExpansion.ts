import { useCallback, useEffect, useState } from 'react';

import type { ProjectGroup, Scope } from '../../../../src/model';
import type { WebviewApi } from '../../host/types';

/** Search expands results temporarily without replacing the user's saved preferences. */
export function useProjectExpansion(host: WebviewApi) {
  const [preferences, setPreferences] = useState(() => {
    const previous = host.getState();
    return { collapsed: previous?.collapsed ?? [], expanded: previous?.expanded ?? [] };
  });
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
