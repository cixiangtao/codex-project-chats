import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.join(root, 'dist');

// Clean owned build output so a previous layout cannot leak stale files into the VSIX.
await rm(output, { recursive: true, force: true });
execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], {
  cwd: root, stdio: 'inherit',
});
await build({
  absWorkingDir: root,
  entryPoints: ['webview/src/main.ts'],
  outfile: 'dist/webview/main.js',
  bundle: true,
  platform: 'browser',
  format: 'esm',
  define: { 'process.env.NODE_ENV': '"production"' },
  minify: true,
  legalComments: 'eof',
  target: 'es2022',
  tsconfig: 'tsconfig.webview.json',
  logLevel: 'info',
});
await mkdir(path.join(output, 'webview'), { recursive: true });
await Promise.all(['view.html', 'view.css'].map(name =>
  copyFile(path.join(root, 'webview/src', name), path.join(output, 'webview', name))));
