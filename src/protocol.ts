import { isRecord, type ProjectGroup, type Scope } from './model';

/** Messages accepted from the local Webview; values are validated at the host boundary. */
export type WebviewMessage =
  | { type: 'ready' | 'refresh' | 'more' }
  | { type: 'scope'; value: Scope }
  | { type: 'search'; value: string }
  | { type: 'open'; id: string };

/** Minimized conversation state shared by the extension and its presentation layer. */
export interface ViewState {
  type: 'state';
  scope: Scope;
  search: string;
  groups: ProjectGroup[];
  busy: boolean;
  opening: string | null;
  error: string;
  hasMore: boolean;
  count: number;
  hasWorkspace: boolean;
}

/** Ignore malformed messages and normalize bounded user input before changing host state. */
export function parseWebviewMessage(value: unknown): WebviewMessage | undefined {
  if (!isRecord(value)) return;
  switch (value.type) {
    case 'ready': case 'refresh': case 'more': return { type: value.type };
    case 'scope':
      if (value.value === 'current' || value.value === 'all') return { type: 'scope', value: value.value };
      break;
    case 'search':
      if (typeof value.value === 'string') return { type: 'search', value: value.value.slice(0, 200) };
      break;
    case 'open':
      if (typeof value.id === 'string' && /^[a-z0-9_-]{8,128}$/i.test(value.id)) return { type: 'open', id: value.id };
  }
}
