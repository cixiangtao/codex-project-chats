import { createLocalizer, serializeLocalization } from './i18n';
import * as vscode from 'vscode';
import { access, realpath, readFile } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { CodexClient } from './client';
import { openInCodex } from './routing';
import { groupChats, isRecord, uniquePaths, type Chat, type Scope } from './model';

const t = createLocalizer(vscode.env.language);
const VIEW_ID = 'codexProjectChats.list';
const OFFICIAL_ID = 'openai.chatgpt';

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
  private client?: CodexClient;
  private binary?: string;
  private scope: Scope;
  private search = '';
  private chats: Chat[] = [];
  private roots: string[] = [];
  private cursor: string | null = null;
  private generation = 0;
  private busy = false;
  private opening: string | null = null;
  private error = '';
  private ready = false;
  private disposed = false;
  private lastRefresh: number | null = null;
  private timer?: ReturnType<typeof setTimeout>;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.scope = context.workspaceState.get<Scope>('scope', 'current');
  }

  async resolveWebviewView(view: vscode.WebviewView): Promise<void> {
    this.view = view;
    view.webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'media')] };
    const template = await readFile(path.join(this.context.extensionPath, 'media', 'view.html'), 'utf8');
    const nonce = randomBytes(18).toString('base64url');
    const asset = (name: string) => view.webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media', name)).toString();
    view.webview.html = template.replaceAll('{{CSP}}', view.webview.cspSource).replaceAll('{{NONCE}}', nonce)
      .replaceAll('{{LOCALIZATION}}', serializeLocalization(vscode.env.language))
      .replaceAll('{{STYLE}}', asset('view.css')).replaceAll('{{SCRIPT}}', asset('view.js'));
    const subscriptions = [view.webview.onDidReceiveMessage((message: unknown) => { void this.handle(message); }),
      view.onDidChangeVisibility(() => {
        if (view.visible && this.ready && Date.now() - (this.lastRefresh ?? 0) > 30_000) void this.refresh();
      })];
    view.onDidDispose(() => {
      for (const subscription of subscriptions) subscription.dispose();
      this.ready = false;
      if (this.view === view) this.view = undefined;
      this.generation++;
      this.client?.dispose(); this.client = undefined;
    });
  }

  private async handle(message: unknown): Promise<void> {
    if (!isRecord(message)) return;
    switch (message.type) {
      case 'ready': this.ready = true; await this.refresh(); break;
      case 'refresh': await this.refresh(); break;
      case 'more': if (!this.busy && this.cursor) await this.load(true); break;
      case 'scope':
        if (message.value !== 'current' && message.value !== 'all') return;
        this.scope = message.value;
        await this.context.workspaceState.update('scope', this.scope);
        await this.refresh();
        break;
      case 'search':
        if (typeof message.value !== 'string') return;
        this.search = message.value.slice(0, 200);
        clearTimeout(this.timer);
        // Invalidate in-flight requests immediately, before the debounce window ends.
        this.generation++;
        this.timer = setTimeout(() => { void this.refresh(); }, 220);
        break;
      case 'open': if (typeof message.id === 'string') await this.open(message.id); break;
    }
  }

  async refresh(): Promise<void> {
    clearTimeout(this.timer);
    await this.load(false);
  }

  private async load(append: boolean): Promise<void> {
    const generation = ++this.generation;
    this.busy = true; this.error = '';
    if (!append) { this.chats = []; this.cursor = null; }
    this.send();
    try {
      const roots = await workspaceRoots();
      if (generation !== this.generation || this.disposed) return;
      this.roots = roots;
      if (this.scope === 'current' && !roots.length) { this.lastRefresh = Date.now(); return; }
      const binary = await getBinary();
      if (generation !== this.generation || this.disposed) return;
      if (!this.client || binary !== this.binary) { this.client?.dispose(); this.client = new CodexClient(binary, vscode.env.language); this.binary = binary; }
      const page = await this.client.list(this.scope === 'current' ? roots : undefined, this.search, append ? this.cursor : null);
      if (generation !== this.generation || this.disposed) return;
      this.chats = [...new Map([...this.chats, ...page.chats].map(chat => [chat.id, chat])).values()];
      this.cursor = page.nextCursor;
      this.lastRefresh = Date.now();
    } catch (error) {
      if (generation === this.generation && !this.disposed) {
        this.error = error instanceof Error ? error.message : t('errorReadFailed');
        this.client?.dispose(); this.client = undefined;
      }
    } finally {
      if (generation === this.generation && !this.disposed) { this.busy = false; this.send(); }
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
    void this.view.webview.postMessage({ type: 'state', scope: this.scope, search: this.search,
      groups: groupChats(this.chats, this.roots), busy: this.busy, opening: this.opening, error: this.error,
      hasMore: Boolean(this.cursor), count: this.chats.length, hasWorkspace: this.roots.length > 0, lastRefresh: this.lastRefresh });
  }

  /** Metadata-free diagnostics used by the isolated extension-host smoke test. */
  snapshot() { return { ready: this.ready, busy: this.busy, count: this.chats.length, error: this.error, scope: this.scope }; }

  dispose(): void {
    this.disposed = true; this.generation++;
    clearTimeout(this.timer);
    this.client?.dispose();
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
