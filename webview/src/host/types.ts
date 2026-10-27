import type { WebviewMessage } from '../../../src/protocol';

/** Local expansion preferences persisted by VS Code across Webview recreation. */
export interface ExpansionState {
  collapsed: string[];
  expanded: string[];
}

export type SendMessage = (message: WebviewMessage) => void;

/** The private browser bridge is acquired once at mount and passed explicitly to the app. */
export interface WebviewApi {
  /** Stored state can come from an older version and must be checked before use. */
  getState(): unknown;
  setState(state: ExpansionState): void;
  postMessage: SendMessage;
}
