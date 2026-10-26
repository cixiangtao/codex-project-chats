import * as vscode from 'vscode';

/**
 * Resume a conversation in the official Codex sidebar already placed by the user.
 *
 * This adapter uses an existing, undocumented Codex URI route. Keeping it
 * here limits future compatibility changes to one place, without patching Codex.
 */
export async function openInCodex(id: string): Promise<void> {
  if (!/^[a-z0-9_-]{8,128}$/i.test(id)) throw new Error('会话 ID 格式不正确。');
  const official = vscode.extensions.getExtension('openai.chatgpt');
  if (!official) throw new Error('请先启用官方 Codex 扩展。');
  await official.activate();
  // For the application URI scheme, asExternalUri creates a callback bound to this
  // window. Sending a raw vscode:// link through the OS can select another window.
  const target = await vscode.env.asExternalUri(vscode.Uri.from({
    scheme: vscode.env.uriScheme, authority: 'openai.chatgpt', path: `/local/${id}`,
  }));
  await vscode.commands.executeCommand('chatgpt.openSidebar');
  if (!await vscode.env.openExternal(target)) throw new Error('官方 Codex 未接受侧栏跳转请求。');
}
