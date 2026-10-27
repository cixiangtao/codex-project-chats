import { execFileSync } from 'node:child_process';
import { copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));

// This directory contains only generated output owned by the two build targets.
await rm(path.join(root, 'dist'), { recursive: true, force: true });
execFileSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], {
  cwd: root, stdio: 'inherit',
});
// Build output must not inherit a developer shell's NODE_ENV=development.
process.env.NODE_ENV = 'production';
await build({ configFile: path.join(root, 'vite.config.mts') });
await copyFile(path.join(root, 'webview/src/app/view.html'), path.join(root, 'dist/webview/view.html'));
