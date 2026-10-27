import { builtinModules } from 'node:module';

import { defineConfig } from 'oxlint';

export default defineConfig({
  plugins: ['typescript', 'react', 'unicorn', 'oxc'],
  categories: { correctness: 'error' },
  env: { browser: true },
  globals: { acquireVsCodeApi: 'readonly' },
  rules: {
    'react/rules-of-hooks': 'error',
    'react/exhaustive-deps': 'error',
    'react/only-export-components': [
      'error',
      {
        allowConstantExport: true,
        allowCompoundComponents: true,
      },
    ],
    'typescript/no-explicit-any': 'error',
    'typescript/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    'no-restricted-imports': [
      'error',
      {
        paths: [
          ...new Set([
            'vscode',
            ...builtinModules,
            ...builtinModules.map((name) => `node:${name}`),
          ]),
        ],
        patterns: [
          {
            regex: '^(?:\\.\\./){2,}src/',
            allowTypeImports: true,
            message: 'Browser code may import host contracts only with import type.',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      // Tests may call host pure helpers and use Node fixture utilities.
      files: ['webview/**/*.test.{ts,tsx}'],
      rules: { 'no-restricted-imports': 'off' },
    },
  ],
});
