// Embed the production Vite assets with the same synthetic bridge used by the dev server.
import fs from 'node:fs/promises';
import path from 'node:path';
import { build } from 'vite';
import { localization, serializeLocalization } from '../dist/extension/i18n.js';
import { loadWebviewAssets } from '../dist/extension/webview-assets.js';

async function main() {
  const language = process.argv[3] || 'zh-CN';
  const { locale } = localization(language);
  const output = path.resolve(import.meta.dirname, '../dist/webview');
  const assets = await loadWebviewAssets(output);
  const [template, css, js, theme] = await Promise.all([
    fs.readFile(path.join(output, 'view.html'), 'utf8'),
    Promise.all(assets.styles.map(file => fs.readFile(path.join(output, file), 'utf8'))).then(parts => parts.join('\n')),
    fs.readFile(path.join(output, assets.script), 'utf8'),
    fs.readFile(new URL('../webview/dev/theme.css', import.meta.url), 'utf8'),
  ]);
  const result = await build({
    configFile: false, publicDir: false, logLevel: 'silent',
    build: {
      write: false, emptyOutDir: false, minify: true, target: 'es2022',
      lib: { entry: path.resolve(import.meta.dirname, '../webview/dev/bridge.ts'), formats: ['es'] },
    },
  });
  const outputs = Array.isArray(result) ? result.flatMap(item => item.output) : result.output;
  const bridge = outputs.find(item => item.type === 'chunk' && item.isEntry);
  if (!bridge) throw new Error('Could not build the sample bridge');
  const html = template.replace('<html lang="en">', `<html lang="${locale}">`)
    .replace('{{LOCALIZATION}}', () => serializeLocalization(language))
    .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '')
    .replace('{{STYLES}}', () => `<style>${theme}\n${css}</style>`)
    .replace('<body>', `<body><aside class="preview-label">Codex Project Chats · ${locale === 'zh-CN' ? '界面预览 / 示例数据' : 'Preview / sample data'}</aside>`)
    .replace('<script type="module" nonce="{{NONCE}}" src="{{SCRIPT}}"></script>',
      () => `<script type="module">(()=>{${bridge.code}})();\n${js}</script>`);
  await fs.writeFile(process.argv[2], html);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
