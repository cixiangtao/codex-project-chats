import { expect, test } from 'vitest';
import { parseWebviewMessage } from '../src/protocol';

test('the host accepts only known messages and validates scope and conversation IDs', () => {
  for (const invalid of [null, [], {}, { type: 'delete' }, { type: 'scope', value: 'other' },
    { type: 'open', id: '../unsafe' }, { type: 'search', value: 123 }]) {
    expect(parseWebviewMessage(invalid)).toBeUndefined();
  }
  expect(parseWebviewMessage({ type: 'open', id: 'thread-0001' })).toEqual({ type: 'open', id: 'thread-0001' });
  expect(parseWebviewMessage({ type: 'search', value: 'x'.repeat(250) })).toEqual({ type: 'search', value: 'x'.repeat(200) });
});
