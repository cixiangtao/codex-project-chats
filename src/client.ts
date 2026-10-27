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
  constructor(private readonly binary: string) {}

  private async start(): Promise<void> {
    if (this.starting) return this.starting;
    this.starting = (async () => {
      const child = spawn(this.binary, ['app-server', '--listen', 'stdio://'], {
        stdio: 'pipe', windowsHide: true, env: { ...process.env, RUST_LOG: 'error' },
      });
      this.process = child;
      child.stdin.on('error', () => { if (this.process === child) this.fail(new Error('Codex 连接已断开，请刷新重试。')); });
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
            pending.reject(new Error(typeof message.error.message === 'string' ? message.error.message : 'Codex 接口请求失败。'));
          } else pending.resolve(message.result);
        } catch { /* Ignore non-JSON diagnostics; the request timeout remains authoritative. */ }
      });
      child.once('error', () => { if (this.process === child) this.fail(new Error('无法启动 Codex。请检查官方扩展或 Codex 可执行文件路径。')); });
      child.once('exit', () => {
        lines.close();
        if (this.process === child) {
          this.process = undefined; this.starting = undefined;
          this.fail(new Error('Codex 列表服务已退出，请刷新重试。'));
        }
      });
      await this.request('initialize', { clientInfo: { name: 'codex_project_chats', title: 'Codex Project Chats', version: '1.0.0' } }); // x-release-please-version
      child.stdin.write(JSON.stringify({ method: 'initialized', params: {} }) + '\n');
    })();
    try { await this.starting; } catch (error) { this.dispose(); throw error; }
  }

  private request(method: string, params: Record<string, unknown>): Promise<unknown> {
    const child = this.process;
    if (!child || child.killed || !child.stdin.writable) return Promise.reject(new Error('Codex 列表服务不可用，请刷新重试。'));
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('读取对话超时，请刷新重试。'));
      }, 20_000);
      this.pending.set(id, { resolve, reject, timer });
      child.stdin.write(JSON.stringify({ method, id, params }) + '\n', error => {
        if (!error) return;
        const pending = this.pending.get(id);
        if (pending) { clearTimeout(pending.timer); this.pending.delete(id); pending.reject(new Error('无法连接 Codex 列表服务。')); }
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
    return parsePage(await this.request('thread/list', params));
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
    this.fail(new Error('对话列表连接已关闭。'));
    if (child && child.exitCode === null) {
      child.stdin.end();
      child.kill();
    }
  }
}
