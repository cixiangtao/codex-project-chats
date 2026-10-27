import { expect, test } from 'vitest';
import { createTimeFormatter } from '../webview/src/time';
import { createLocalizer } from '../src/i18n';

const en = createTimeFormatter('en', createLocalizer('en'));
const zh = createTimeFormatter('zh-CN', createLocalizer('zh-CN'));

test('relative time handles minute boundaries, absent dates, and future clock skew', () => {
  const now = new Date(2026, 9, 27, 12).getTime();
  expect(en(now / 1000 - 59, now)).toBe('Just now');
  expect(en(now / 1000 - 60, now)).toBe('1m ago');
  expect(zh(now / 1000 - 3600, now)).toBe('1小时前');
  expect(en(now / 1000 + 300, now)).toBe('Just now');
  for (const value of [0, -1, NaN, Infinity, 1e20]) expect(en(value, now)).toBe('Unknown');
});

test('calendar-day labels change across midnight even before 24 hours have elapsed', () => {
  const now = new Date(2026, 9, 27, 0, 30).getTime();
  const yesterday = new Date(2026, 9, 26, 22).getTime() / 1000;
  expect(en(yesterday, now)).toBe('Yesterday');
  expect(zh(yesterday, now)).toBe('昨天');
  expect(en(new Date(2026, 9, 25, 12).getTime() / 1000, now)).toBe('2d ago');
});

test('older dates retain the year only across calendar years', () => {
  const now = new Date(2026, 9, 27, 12).getTime();
  const sameYear = new Date(2026, 9, 17, 12).getTime() / 1000;
  const lastYear = new Date(2025, 9, 17, 12).getTime() / 1000;
  expect(en(sameYear, now)).toBe('Oct 17');
  expect(en(lastYear, now)).toBe('Oct 17, 2025');
  expect(zh(lastYear, now)).toBe('25/10/17');
});
