// Generate a standalone preview using the production HTML/CSS/JS with an explicit sample-data bridge.
import fs from 'node:fs/promises';
import path from 'node:path';
import { localization, serializeLocalization } from '../dist/extension/i18n.js';
import { groupChats } from '../dist/extension/model.js';
async function main() {
  const language = process.argv[3] || 'zh-CN';
  const { locale } = localization(language);
  const root = '/projects/codex-project-chats';
  const now = Math.floor(Date.now() / 1000);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1); yesterday.setHours(12, 0, 0, 0);
  const englishTitles = {
    'thread-0001': 'Refine compact rows and conversation details',
    'thread-0002': 'Fix sidebar search and pagination',
    'thread-0003': 'Check Codex navigation and sidebar placement',
    'thread-0009': 'Document installation and everyday use',
    'thread-0010': 'Review directory matching in multi-root workspaces',
    'thread-0011': 'Review last year’s compatibility notes',
    'thread-0004': 'Adjust homepage navigation',
    'thread-0005': 'Improve the mobile layout',
    'thread-0006': 'Investigate the sign-in endpoint',
    'thread-0007': 'Check the company project build',
    'thread-0008': 'Organize personal project settings',
  };
  const chats = [
    ['thread-0001', root, '调整对话列表的紧凑布局与悬停详情', now - 180],
    ['thread-0002', root, '修复侧栏搜索与分页', now - 3600],
    ['thread-0003', root, '检查官方 Codex 跳转入口与侧栏位置兼容性', now - 7200],
    ['thread-0009', root, '整理扩展的安装与使用说明', Math.floor(yesterday.getTime() / 1000)],
    ['thread-0010', root, '排查多根工作区的目录匹配', now - 864000],
    ['thread-0011', root, '整理上一年度的兼容性记录', Math.floor(new Date(new Date().getFullYear() - 1, 11, 18).getTime() / 1000)],
    ['thread-0004', '/projects/website', '调整首页导航', now - 10000],
    ['thread-0005', '/projects/website', '优化移动端布局', now - 20000],
    ['thread-0006', '/projects/api-service', '排查登录接口', now - 40000],
    ['thread-0007', '/projects/company/app', '检查公司项目构建', now - 50000],
    ['thread-0008', '/projects/personal/app', '整理个人项目配置', now - 60000],
  ].map(([id, cwd, title, updatedAt]) => ({ id, cwd, title: locale === 'en' ? englishTitles[id] : title, updatedAt }));
  const groups = groupChats(chats, [root]);
  const output = path.resolve(import.meta.dirname, '../dist/webview');
  const [template, css, js] = await Promise.all(['view.html', 'view.css', 'main.js'].map(name => fs.readFile(path.join(output, name), 'utf8')));
  const theme = `:root{--vscode-sideBar-background:#181818;--vscode-sideBar-foreground:#ccc;--vscode-foreground:#ccc;--vscode-font-size:13px;--vscode-font-family:-apple-system,BlinkMacSystemFont,sans-serif;--vscode-input-background:#313131;--vscode-input-foreground:#ccc;--vscode-input-placeholderForeground:#aaa;--vscode-input-border:#3c3c3c;--vscode-widget-border:#313131;--vscode-list-activeSelectionBackground:#04395e;--vscode-list-activeSelectionForeground:#fff;--vscode-list-hoverBackground:#2a2d2e;--vscode-descriptionForeground:#aaa;--vscode-textLink-foreground:#4daafc;--vscode-focusBorder:#007fd4;--vscode-button-secondaryBackground:#313131;--vscode-button-secondaryForeground:#ccc;--vscode-button-secondaryHoverBackground:#3c3c3c;--vscode-toolbar-hoverBackground:#2a2d2e;--vscode-scrollbarSlider-background:#79797966;--vscode-scrollbarSlider-hoverBackground:#646464b3;--vscode-editor-selectionBackground:#264f78;--vscode-errorForeground:#f48771;}body{max-width:360px;min-height:680px;border-right:1px solid #313131}.preview-label{padding:7px 12px;border-bottom:1px solid #313131;font-size:11px;color:#aaa}`;
  const bridge = `const sampleGroups=${JSON.stringify(groups)};let state={scope:'current',search:'',busy:false,opening:null,error:'',hasMore:false,hasWorkspace:true,lastRefresh:Date.now()};let saved;
function acquireVsCodeApi(){return{getState:()=>saved,setState:v=>{saved=v},postMessage:msg=>{
if(msg.type==='scope')state.scope=msg.value;if(msg.type==='search')state.search=msg.value;
if(msg.type==='open'){document.getElementById('footer').textContent=${JSON.stringify(locale === 'zh-CN' ? '示例预览：实际安装后在官方 Codex 中打开' : 'Sample preview: installed extension opens official Codex')};return;}
const groups=sampleGroups.filter(g=>state.scope==='all'||g.current).map(g=>({...g,chats:g.chats.filter(c=>c.title.includes(state.search))})).filter(g=>g.chats.length);
setTimeout(()=>window.postMessage({type:'state',...state,groups,count:groups.reduce((n,g)=>n+g.chats.length,0)},'*'),20);
}}}`;
  const html = template.replace('{{LOCALIZATION}}', serializeLocalization(language)).replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '')
    .replace('<link rel="stylesheet" href="{{STYLE}}">', () => `<style>${theme}\n${css}</style>`)
    .replace('<body>', `<body><aside class="preview-label">Codex Project Chats · ${locale === 'zh-CN' ? '界面预览 / 示例数据' : 'Preview / sample data'}</aside>`)
    .replace('<script type="module" nonce="{{NONCE}}" src="{{SCRIPT}}"></script>', () => `<script type="module">${bridge}\n${js}</script>`);
  await fs.writeFile(process.argv[2], html);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
