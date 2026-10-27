import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { isRecord } from './model';

export interface WebviewAssets { script: string; styles: string[] }

/** Resolve the browser entry and CSS from Vite's manifest instead of guessing output names. */
export function parseWebviewAssets(value: unknown): WebviewAssets {
  if (!isRecord(value)) throw new Error('Invalid Webview asset manifest');
  const entries = Object.values(value).filter(entry => isRecord(entry) && entry.isEntry === true);
  const entry = entries[0];
  if (entries.length !== 1 || !isRecord(entry) || typeof entry.file !== 'string'
    || !Array.isArray(entry.css) || !entry.css.length || !entry.css.every(file => typeof file === 'string')) {
    throw new Error('Expected one Webview entry with its styles in the asset manifest');
  }
  return { script: entry.file, styles: entry.css };
}

export async function loadWebviewAssets(directory: string): Promise<WebviewAssets> {
  return parseWebviewAssets(JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8')));
}
