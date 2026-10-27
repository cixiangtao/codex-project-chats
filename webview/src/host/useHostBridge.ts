import { useCallback, useEffect } from 'react';

import type { ViewState, WebviewMessage } from '../../../src/protocol';
import type { WebviewApi } from './types';

/** Subscribe before announcing readiness; release the listener when this view unmounts. */
export function useHostBridge(host: WebviewApi, receive: (state: ViewState) => void) {
  const send = useCallback((message: WebviewMessage) => host.postMessage(message), [host]);
  useEffect(() => {
    const onMessage = (event: MessageEvent<ViewState>) => {
      if (event.data?.type === 'state') receive(event.data);
    };
    window.addEventListener('message', onMessage);
    send({ type: 'ready' });
    return () => window.removeEventListener('message', onMessage);
  }, [send, receive]);
  return send;
}
