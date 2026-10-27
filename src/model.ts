import { createLocalizer, type Localize } from './i18n';
import path from 'node:path';

/** Minimal thread metadata; conversation bodies never enter the view model. */
export interface Chat {
  id: string;
  title: string;
  cwd: string;
  updatedAt: number;
}

export interface ChatPage { chats: Chat[]; nextCursor: string | null }
export interface ProjectGroup { key: string; name: string; cwd: string; current: boolean; chats: Chat[] }
export type Scope = 'current' | 'all';

/** Parse untrusted protocol data without passing raw API objects into a webview. */
export function parsePage(value: unknown, t: Localize = createLocalizer()): ChatPage {
  if (!isRecord(value) || !Array.isArray(value.data)) throw new Error(t('errorInvalidResponse'));
  const chats: Chat[] = [];
  for (const row of value.data) {
    if (!isRecord(row) || typeof row.id !== 'string' || !/^[a-z0-9_-]{8,128}$/i.test(row.id)
      || typeof row.cwd !== 'string' || !row.cwd) continue;
    const title = typeof row.name === 'string' && row.name.trim() ? row.name : typeof row.preview === 'string' ? row.preview : '';
    chats.push({ id: row.id, title: title.replace(/\s+/g, ' ').trim() || t('untitled'), cwd: row.cwd,
      updatedAt: typeof row.updatedAt === 'number' && Number.isFinite(row.updatedAt) ? row.updatedAt : 0 });
  }
  return { chats, nextCursor: typeof value.nextCursor === 'string' && value.nextCursor ? value.nextCursor : null };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Only Windows paths are case-insensitive. Keep distinct macOS/Linux paths distinct. */
export function pathKey(value: string): string {
  const windows = /^[a-z]:[\\/]/i.test(value) || value.startsWith('\\\\');
  if (windows) return path.win32.normalize(value).replace(/[\\/]+$/, '').toLowerCase();
  return path.posix.normalize(value).replace(/\/$/, '') || '/';
}

/** Query exact workspace paths and their real paths so symlinked workspaces remain usable. */
export function uniquePaths(paths: string[]): string[] {
  return [...new Map(paths.map(value => [pathKey(value), value])).values()];
}

/** Group before rendering and disambiguate projects with the same folder basename. */
export function groupChats(chats: Chat[], roots: string[]): ProjectGroup[] {
  const rootKeys = new Set(roots.map(pathKey));
  const groups = new Map<string, ProjectGroup>();
  for (const chat of chats) {
    const key = pathKey(chat.cwd);
    let group = groups.get(key);
    if (!group) {
      const normalized = chat.cwd.replace(/\\/g, '/').replace(/\/$/, '');
      group = { key, name: normalized.split('/').at(-1) || chat.cwd, cwd: chat.cwd, current: rootKeys.has(key), chats: [] };
      groups.set(key, group);
    }
    group.chats.push(chat);
  }
  const result = [...groups.values()];
  for (const group of result) group.chats.sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
  return result.sort((a, b) => Number(b.current) - Number(a.current)
    || (b.chats[0]?.updatedAt ?? 0) - (a.chats[0]?.updatedAt ?? 0) || a.cwd.localeCompare(b.cwd));
}
