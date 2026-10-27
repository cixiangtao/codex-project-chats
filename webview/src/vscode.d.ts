interface ProjectChatsWebviewApi {
  getState(): { collapsed?: string[]; expanded?: string[] } | undefined;
  setState(state: { collapsed: string[]; expanded: string[] }): void;
  postMessage(message: import('../../src/protocol').WebviewMessage): void;
}
declare function acquireVsCodeApi(): ProjectChatsWebviewApi;
