import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const directory = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  root: directory('./webview'),
  base: './',
  publicDir: false,
  plugins: [
    react(),
    {
      name: 'project-chats-sample-page',
      apply: 'serve',
      transformIndexHtml: {
        order: 'pre',
        async handler(html, context) {
          if (!context.server) return html;
          const { localization, serializeLocalization } = (await context.server.ssrLoadModule(
            directory('./src/i18n.ts'),
          )) as typeof import('./src/i18n.ts');
          const language =
            new URL(context.originalUrl ?? context.path, 'http://localhost').searchParams.get(
              'lang',
            ) || 'zh-CN';
          return html
            .replace('<html lang="en">', `<html lang="${localization(language).locale}">`)
            .replace('{{LOCALIZATION}}', () => serializeLocalization(language));
        },
      },
    },
  ],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  build: {
    outDir: directory('./dist/webview'),
    emptyOutDir: true,
    target: 'es2022',
    manifest: 'manifest.json',
    modulePreload: false,
    rolldownOptions: { input: directory('./webview/src/main.ts') },
  },
});
