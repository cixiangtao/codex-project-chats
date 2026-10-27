import { createLocalizer, type Localize } from './i18n';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { isRecord, parsePage, type ChatPage } from './model';

interface Pending {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** A local stdio client, restricted by this extension to initialize and thread/list. */
export class CodexClient {
  private process?: ChildProcessWithoutNullStreams;
  private nextId = 0;
  private pending = new Map<number, Pending>();
  private starting?: Promise<void>;
  private readonly t: Localize;
  constructor(private readonly binary: string, language = 'en') { this.t = createLocalizer(language); }

  private async start(): Promise<void> {
    if (this.starting) return this.starting;
    this.starting = (async () => {
      const child = spawn(this.binary, ['app-server', '--listen', 'stdio://'], {
        stdio: 'pipe', windowsHide: true, env: { ...process.env, RUST_LOG: 'error' },
      });
      this.process = child;
      child.stdin.on('error', () => { if (this.process === child) this.fail(new Error(this.t('errorDisconnected'))); });
      child.stderr.resume(); // Never print protocol diagnostics that may contain local paths or metadata.
      const lines = createInterface({ input: child.stdout });
      lines.on('line', line => {
        try {
          const message: unknown = JSON.parse(line);
          if (!isRecord(message) || typeof message.id !== 'number') return;
          const pending = this.pending.get(message.id);
          if (!pending) return;
          this.pending.delete(message.id);
          clearTimeout(pending.timer);
          if (isRecord(message.error)) {
            pending.reject(new Error(typeof message.error.message === 'string' ? message.error.message : this.t('errorRequestFailed')));
          } else pending.resolve(message.result);
        } catch { /* Ignore non-JSON diagnostics; the request timeout remains authoritative. */ }
      });
      child.once('error', () => { if (this.process === child) this.fail(new Error(this.t('errorStartFailed'))); });
      child.once('exit', () => {
        lines.close();
        if (this.process === child) {
          this.process = undefined; this.starting = undefined;
          this.fail(new Error(this.t('errorExited')));
        }
      });
      await this.request('initialize', { clientInfo: { name: 'codex_project_chats', title: 'Codex Project Chats', version: '1.1.0' } }); // x-release-please-version
      child.stdin.write(JSON.stringify({ method: 'initialized', params: {} }) + '\n');
    })();
    try { await this.starting; } catch (error) { this.dispose(); throw error; }
  }

  private request(method: string, params: Record<string, unknown>): Promise<unknown> {
    const child = this.process;
    if (!child || child.killed || !child.stdin.writable) return Promise.reject(new Error(this.t('errorUnavailable')));
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(this.t('errorTimeout')));
      }, 20_000);
      this.pending.set(id, { resolve, reject, timer });
      child.stdin.write(JSON.stringify({ method, id, params }) + '\n', error => {
        if (!error) return;
        const pending = this.pending.get(id);
        if (pending) { clearTimeout(pending.timer); this.pending.delete(id); pending.reject(new Error(this.t('errorConnectFailed'))); }
      });
    });
  }

  /** Server-side filters apply before pagination; never scan a truncated global list for a project. */
  async list(roots: string[] | undefined, search: string, cursor: string | null): Promise<ChatPage> {
    await this.start();
    const params: Record<string, unknown> = {
      archived: false, limit: 50, sortKey: 'updated_at', sortDirection: 'desc',
      sourceKinds: ['vscode', 'cli', 'appServer'], useStateDbOnly: true,
    };
    if (roots !== undefined) {
      if (!roots.length) return { chats: [], nextCursor: null };
      params.cwd = roots;
    }
    if (search.trim()) params.searchTerm = search.trim();
    if (cursor) params.cursor = cursor;
    return parsePage(await this.request('thread/list', params), this.t);
  }

  private fail(error: Error): void {
    for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(error); }
    this.pending.clear();
  }

  /** Close only the stdio process owned by this client; never terminate another Codex server. */
  dispose(): void {
    const child = this.process;
    this.process = undefined;
    this.starting = undefined;
    this.fail(new Error(this.t('errorClosed')));
    if (child && child.exitCode === null) {
      child.stdin.end();
      child.kill();
    }
  }
}
