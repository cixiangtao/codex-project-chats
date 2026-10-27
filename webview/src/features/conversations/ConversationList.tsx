import { useMemo } from 'react';

import type { ViewState } from '../../../../src/protocol';
import { useVisibleClock } from '../../hooks/useVisibleClock';
import type { SendMessage, WebviewApi } from '../../host/types';
import { useStrings } from '../../i18n/context';
import type { ConversationRowProps } from './ConversationRow';
import { ProjectGroup } from './ProjectGroup';
import { createTimeFormatter } from './time';
import { useProjectExpansion } from './useProjectExpansion';
import type { Tooltip } from './useTooltip';

interface ConversationListProps {
  state: ViewState;
  host: WebviewApi;
  send: SendMessage;
  tooltip: Tooltip;
  register: ConversationRowProps['register'];
}

/** Own list-specific expansion, duplicate labels, and the shared clock for relative times. */
export function ConversationList({ state, host, send, tooltip, register }: ConversationListProps) {
  const { locale, t } = useStrings();
  const clock = useVisibleClock();
  const formatTime = useMemo(() => createTimeFormatter(locale, t), [locale, t]);
  const { isOpen, setOpen } = useProjectExpansion(host);
  const names = useMemo(() => {
    const counts = new Map<string, number>();
    for (const group of state.groups) counts.set(group.name, (counts.get(group.name) ?? 0) + 1);
    return counts;
  }, [state.groups]);
  const searching = Boolean(state.search);
  return (
    <main id="groups" aria-label={t('groups')}>
      {state.groups.map((group) => (
        <ProjectGroup
          key={group.key}
          group={group}
          open={isOpen(group, state.scope, searching)}
          duplicate={(names.get(group.name) ?? 0) > 1}
          searching={searching}
          setOpen={setOpen}
          opening={state.opening}
          clock={clock}
          formatTime={formatTime}
          tooltip={tooltip}
          send={send}
          register={register}
        />
      ))}
    </main>
  );
}
