import { expect, test } from 'vitest';
import { parseWebviewAssets } from '../src/webview-assets';

test('Vite entry metadata resolves hashed JavaScript and all extracted styles', () => {
  expect(parseWebviewAssets({
    'src/main.ts': { isEntry: true, file: 'assets/main-a1b2.js', css: ['assets/main-c3d4.css', 'assets/theme.css'] },
    'other.ts': { file: 'assets/other.js' },
  })).toEqual({ script: 'assets/main-a1b2.js', styles: ['assets/main-c3d4.css', 'assets/theme.css'] });
});

test('broken or ambiguous manifests fail before the Webview receives missing resources', () => {
  for (const value of [null, [], {}, { entry: { isEntry: true, file: 'entry.js' } },
    { first: { isEntry: true }, second: { isEntry: true } }]) {
    expect(() => parseWebviewAssets(value)).toThrow(/manifest/);
  }
});
