import { createLocalizer, serializeLocalization } from './i18n';
import * as vscode from 'vscode';
import { access, realpath, readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { CodexClient } from './client';
import { openInCodex } from './routing';
import { groupChats, uniquePaths, type Chat, type Scope } from './model';
import { parseWebviewMessage, type ViewState } from './protocol';
import { loadWebviewAssets } from './webview-assets';

const t = createLocalizer(vscode.env.language);
const VIEW_ID = 'codexProjectChats.list';
const OFFICIAL_ID = 'openai.chatgpt';
const AUTO_REFRESH_MS = 5_000;

async function getBinary(): Promise<string> {
  const configured = vscode.workspace.getConfiguration('codexProjectChats').get<string>('cliPath', '').trim();
  if (configured) {
    if (!path.isAbsolute(configured)) throw new Error(t('errorAbsolutePath'));
    await access(configured);
    return configured;
  }
  const official = vscode.extensions.getExtension(OFFICIAL_ID);
  if (!official) throw new Error(t('errorInstallOfficial'));
  if (process.platform === 'win32' && vscode.workspace.getConfiguration('chatgpt').get('runCodexInWindowsSubsystemForLinux')) {
    throw new Error(t('errorWsl'));
  }
  const os = { darwin: 'macos', win32: 'windows', linux: 'linux' }[process.platform as 'darwin' | 'win32' | 'linux'];
  const arch = { arm64: 'aarch64', x64: 'x86_64' }[process.arch as 'arm64' | 'x64'];
  if (!os || !arch) throw new Error(t('errorArchitecture'));
  const binary = path.join(official.extensionPath, 'bin', `${os}-${arch}`, process.platform === 'win32' ? 'codex.exe' : 'codex');
  try { await access(binary); } catch { throw new Error(t('errorBinaryMissing')); }
  return binary;
}

async function workspaceRoots(): Promise<string[]> {
  const roots = (vscode.workspace.workspaceFolders ?? [])
    .filter(folder => folder.uri.scheme === 'file' || (vscode.env.remoteName && folder.uri.scheme === 'vscode-remote'))
    .map(folder => folder.uri.fsPath);
  const resolved = await Promise.all(roots.map(async root => { try { return await realpath(root); } catch { return root; } }));
  return uniquePaths([...roots, ...resolved]);
}

class ProjectChatsView implements vscode.WebviewViewProvider, vscode.Disposable {
  private view?: vscode.WebviewView;
  private viewSubscriptions: vscode.Disposable[] = [];
  private client?: CodexClient;
  private binary?: string;
  private scope: Scope;
  private search = '';
  private chats: Chat[] = [];
  private roots: string[] = [];
  private cursor: string | null = null;
  private loadedPages = 1;
  private generation = 0;
  private loading = false;
  private busy = false;
  private opening: string | null = null;
  private error = '';
  private ready = false;
  private disposed = false;
  private searchTimer?: ReturnType<typeof setTimeout>;
  private autoRefreshTimer?: ReturnType<typeof setTimeout>;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.scope = context.workspaceState.get<Scope>('scope', 'current');
  }

  async resolveWebviewView(view: vscode.WebviewView): Promise<void> {
    if (this.disposed) return;
    this.releaseView();
    this.view = view;
    view.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview')] };
    this.viewSubscriptions = [
      view.webview.onDidReceiveMessage((message: unknown) => {
        if (this.view === view) void this.handle(message);
      }),
      view.onDidChangeVisibility(() => {
        if (this.view !== view) return;
        this.clearAutoRefresh();
        if (view.visible) void this.autoRefresh();
      }),
      view.onDidDispose(() => this.releaseView(view)),
    ];
    const template = await readFile(path.join(this.context.extensionPath, 'dist', 'webview', 'view.html'), 'utf8');
    if (this.view !== view || this.disposed) return;
    const assets = await loadWebviewAssets(path.join(this.context.extensionPath, 'dist', 'webview'));
    if (this.view !== view || this.disposed) return;
    const nonce = randomBytes(18).toString('base64url');
    const asset = (name: string) => view.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webview', name)).toString();
    view.webview.html = template.replaceAll('{{CSP}}', view.webview.cspSource).replaceAll('{{NONCE}}', nonce)
      .replaceAll('{{LOCALIZATION}}', serializeLocalization(vscode.env.language))
      .replaceAll('{{STYLES}}', () => assets.styles.map(file => `<link rel="stylesheet" href="${asset(file)}">`).join(''))
      .replaceAll('{{SCRIPT}}', () => asset(assets.script));
  }

  /** A view owns its subscriptions, refresh timers, and list-service connection. */
  private releaseView(view = this.view): void {
    if (view !== this.view) return;
    this.view = undefined;
    this.ready = false;
    this.generation++;
    clearTimeout(this.searchTimer);
    this.searchTimer = undefined;
    this.clearAutoRefresh();
    this.loading = false;
    this.busy = false;
    this.client?.dispose();
    this.client = undefined;
    this.binary = undefined;
    for (const subscription of this.viewSubscriptions.splice(0)) subscription.dispose();
  }

  private isCurrent(generation: number): boolean {
    return generation === this.generation && !this.disposed && this.ready && this.view !== undefined;
  }

  private async handle(value: unknown): Promise<void> {
    const message = parseWebviewMessage(value);
    if (this.disposed || !this.view || !message) return;
    if (message.type !== 'ready' && !this.ready) return;
    switch (message.type) {
      case 'ready': this.ready = true; await this.refresh(); break;
      case 'refresh': await this.refresh(); break;
      case 'more': if (!this.busy && this.cursor) await this.load(true); break;
      case 'scope':
        this.scope = message.value;
        // Invalidate the old query immediately; persisting the preference must not delay it.
        await Promise.all([this.refresh(), this.context.workspaceState.update('scope', this.scope)]);
        break;
      case 'search':
        this.search = message.value;
        clearTimeout(this.searchTimer);
        this.clearAutoRefresh();
        // Invalidate in-flight requests immediately, before the debounce window ends.
        this.generation++;
        this.searchTimer = setTimeout(() => { void this.refresh(); }, 220);
        break;
      case 'open': await this.open(message.id); break;
    }
  }

  async refresh(): Promise<void> {
    clearTimeout(this.searchTimer);
    this.searchTimer = undefined;
    if (!this.disposed && this.view && this.ready) await this.load(false);
  }

  private clearAutoRefresh(): void {
    clearTimeout(this.autoRefreshTimer);
    this.autoRefreshTimer = undefined;
  }

  /** Poll stored metadata only while visible; this client owns a separate app-server. */
  private async autoRefresh(): Promise<void> {
    if (!this.view?.visible || !this.ready || this.disposed || this.loading || this.searchTimer) return;
    await this.load(false, true);
  }

  private scheduleAutoRefresh(): void {
    this.clearAutoRefresh();
    if (!this.view?.visible || !this.ready || this.disposed || this.searchTimer) return;
    this.autoRefreshTimer = setTimeout(() => {
      this.autoRefreshTimer = undefined;
      void this.autoRefresh();
    }, AUTO_REFRESH_MS);
  }

  private async load(append: boolean, background = false): Promise<void> {
    if (this.disposed || !this.view || !this.ready) return;
    this.clearAutoRefresh();
    const generation = ++this.generation;
    this.loading = true;
    this.busy = !background;
    let changed = false;
    if (!background) {
      this.error = '';
      if (!append) { this.chats = []; this.cursor = null; this.loadedPages = 1; }
      this.send();
    }
    try {
      const roots = await workspaceRoots();
      if (!this.isCurrent(generation)) return;
      let chats = append ? this.chats : [];
      let cursor = append ? this.cursor : null;
      let pages = 0;
      if (this.scope !== 'current' || roots.length) {
        const binary = await getBinary();
        if (!this.isCurrent(generation)) return;
        if (!this.client || binary !== this.binary) { this.client?.dispose(); this.client = new CodexClient(binary, this.context.extension.packageJSON.version, vscode.env.language); this.binary = binary; }
        // Rebuild every loaded page so removals and changed ordering cannot leave a stale tail.
        const pageLimit = background ? this.loadedPages : 1;
        do {
          const page = await this.client.list(this.scope === 'current' ? roots : undefined, this.search, cursor);
          if (!this.isCurrent(generation)) return;
          chats = [...new Map([...chats, ...page.chats].map(chat => [chat.id, chat])).values()];
          cursor = page.nextCursor;
          pages++;
        } while (cursor && pages < pageLimit);
      }
      changed = this.error !== '' || cursor !== this.cursor || roots.length !== this.roots.length
        || roots.some((root, index) => root !== this.roots[index]) || chats.length !== this.chats.length
        || chats.some((chat, index) => {
          const previous = this.chats[index];
          return !previous || chat.id !== previous.id || chat.title !== previous.title
            || chat.cwd !== previous.cwd || chat.recencyAt !== previous.recencyAt;
        });
      this.roots = roots;
      this.chats = chats;
      this.cursor = cursor;
      this.loadedPages = append ? this.loadedPages + pages : Math.max(1, pages);
      this.error = '';
    } catch (error) {
      if (this.isCurrent(generation)) {
        const message = error instanceof Error ? error.message : t('errorReadFailed');
        changed = this.error !== message;
        this.error = message;
        this.client?.dispose(); this.client = undefined;
      }
    } finally {
      if (this.isCurrent(generation)) {
        this.loading = false; this.busy = false;
        if (!background || changed) this.send();
        this.scheduleAutoRefresh();
      }
    }
  }

  private async open(id: string): Promise<void> {
    if (this.opening || !this.chats.some(chat => chat.id === id)) return;
    this.opening = id; this.send();
    try {
      await openInCodex(id);
    } catch {
      void vscode.window.showErrorMessage(t('errorOpenFailed'), t('copyId')).then(action => {
        if (action) void vscode.env.clipboard.writeText(id);
      });
    } finally { this.opening = null; this.send(); }
  }

  private send(): void {
    if (!this.view || !this.ready || this.disposed) return;
    const state: ViewState = { type: 'state', scope: this.scope, search: this.search,
      groups: groupChats(this.chats, this.roots), busy: this.busy, opening: this.opening, error: this.error,
      hasMore: Boolean(this.cursor), count: this.chats.length, hasWorkspace: this.roots.length > 0 };
    void this.view.webview.postMessage(state);
  }

  /** Metadata-free diagnostics used by the isolated extension-host smoke test. */
  snapshot() { return { ready: this.ready, busy: this.busy, count: this.chats.length, error: this.error, scope: this.scope }; }

  dispose(): void {
    this.disposed = true;
    this.releaseView();
  }
}

/** Register a small, local navigation surface without modifying the official extension. */
export function activate(context: vscode.ExtensionContext) {
  const provider = new ProjectChatsView(context);
  context.subscriptions.push(provider,
    vscode.window.registerWebviewViewProvider(VIEW_ID, provider),
    vscode.commands.registerCommand('codexProjectChats.open', () => vscode.commands.executeCommand(`${VIEW_ID}.focus`)),
    vscode.commands.registerCommand('codexProjectChats.refresh', () => provider.refresh()),
    vscode.workspace.onDidChangeWorkspaceFolders(() => { void provider.refresh(); }),
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('codexProjectChats.cliPath')) void provider.refresh();
    }));
  return { snapshot: () => provider.snapshot() };
}
