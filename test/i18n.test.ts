import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { localization, createLocalizer, serializeLocalization, type MessageKey } from '../src/i18n';
import { parsePage } from '../src/model';

test('Chinese display languages select Chinese, with English as the default fallback', () => {
  for (const language of ['zh', 'zh-cn', 'ZH-CN', 'zh-TW', 'zh-Hant']) {
    assert.equal(localization(language).locale, 'zh-CN');
    assert.equal(createLocalizer(language)('current'), '当前项目');
  }
  for (const language of [undefined, 'en', 'en-US', 'fr', 'ja', 'zhfoo']) {
    assert.equal(localization(language).locale, 'en');
    assert.equal(createLocalizer(language)('current'), 'Current project');
  }
});

test('both languages provide complete messages with matching interpolation parameters', () => {
  const en = localization('en').messages;
  const zh = localization('zh-CN').messages;
  assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort());
  const parameters = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const key of Object.keys(en) as MessageKey[]) {
    assert(en[key].trim() && zh[key].trim(), key);
    assert.deepEqual(parameters(en[key]), parameters(zh[key]), key);
  }
  for (const language of ['en', 'zh-CN']) {
    assert.deepEqual(JSON.parse(serializeLocalization(language)), localization(language));
    assert(!serializeLocalization(language).includes('<'));
  }
});

test('formatting preserves user content without treating it as another template', () => {
  const title = '$& {time} </script> 原标题';
  assert.equal(createLocalizer('en')('openLabel', { title, time: 'Yesterday' }),
    `${title}, recent conversation: Yesterday, open in Codex`);
  assert.equal(createLocalizer('zh-CN')('openLabel', { title, time: '昨天' }),
    `${title}，最近对话：昨天，在 Codex 中打开`);
});

test('unnamed conversations and protocol errors are localized without translating real titles', () => {
  for (const [language, untitled, error] of [
    ['en', 'Untitled conversation', /unrecognized conversation list/],
    ['zh-CN', '未命名对话', /无法识别的列表格式/],
  ] as const) {
    const t = createLocalizer(language);
    const page = parsePage({ data: [
      { id: 'thread-0001', cwd: '/sample', name: '' },
      { id: 'thread-0002', cwd: '/sample', name: '原始标题 Original title' },
    ] }, t);
    assert.equal(page.chats[0]?.title, untitled);
    assert.equal(page.chats[1]?.title, '原始标题 Original title');
    assert.throws(() => parsePage({ data: null }, t), error);
  }
});

test('all manifest localization references resolve in English and Chinese', () => {
  const root = path.join(import.meta.dirname, '..');
  const manifest = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
  const keys = [...manifest.matchAll(/%([^%]+)%/g)].flatMap(match => match[1] ? [match[1]] : []);
  assert(keys.length > 0);
  for (const file of ['package.nls.json', 'package.nls.zh.json', 'package.nls.zh-cn.json']) {
    const messages: Record<string, string> = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
    assert.deepEqual(Object.keys(messages).sort(), [...keys].sort());
    for (const key of keys) assert(messages[key]?.trim(), `${file}: ${key}`);
  }
});
