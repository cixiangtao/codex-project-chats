import { useCallback, useState } from 'react';

import type { ViewState } from '../../../src/protocol';
import { ScopeSwitcher } from '../components/header/ScopeSwitcher';
import { SearchInput } from '../components/header/SearchInput';
import { Toolbar } from '../components/header/Toolbar';
import { StatusArea } from '../components/status/StatusArea';
import { ConversationList } from '../features/conversations/ConversationList';
import { ConversationTooltip } from '../features/conversations/ConversationTooltip';
import { useConversationFocus } from '../features/conversations/useConversationFocus';
import { useTooltip } from '../features/conversations/useTooltip';
import type { WebviewApi } from '../host/types';
import { useHostBridge } from '../host/useHostBridge';

const initialState: ViewState = {
  type: 'state',
  scope: 'current',
  search: '',
  groups: [],
  busy: true,
  opening: null,
  error: '',
  hasMore: false,
  count: 0,
  hasWorkspace: true,
};

/** Compose host state with the interface; capture focus before applying each host update. */
export function App({ host }: { host: WebviewApi }) {
  const [state, setState] = useState(initialState);
  const tooltip = useTooltip();
  const { hide } = tooltip;
  const { register, remember } = useConversationFocus(state);
  const receive = useCallback(
    (next: ViewState) => {
      remember();
      hide();
      setState(next);
    },
    [remember, hide],
  );
  const send = useHostBridge(host, receive);

  return (
    <>
      <header>
        <ScopeSwitcher scope={state.scope} send={send} />
        <SearchInput value={state.search} send={send} />
        <Toolbar state={state} send={send} />
      </header>
      <ConversationList
        state={state}
        host={host}
        send={send}
        register={register}
        tooltip={tooltip}
      />
      <StatusArea state={state} send={send} />
      <ConversationTooltip tooltip={tooltip} />
    </>
  );
}
