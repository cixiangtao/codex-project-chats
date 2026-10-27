import type { WebviewApi } from './host/types';

declare global {
  function acquireVsCodeApi(): WebviewApi;
}
