import { useLayoutEffect, useRef } from 'react';

import type { SendMessage } from '../../host/types';
import { useStrings } from '../../i18n/context';
export function SearchInput({ value, send }: { value: string; send: SendMessage }) {
  const { t } = useStrings();
  const input = useRef<HTMLInputElement>(null);
  const composing = useRef(false);
  useLayoutEffect(() => {
    if (input.current && document.activeElement !== input.current && !composing.current)
      input.current.value = value;
  }, [value]);
  return (
    <div className="search">
      <svg aria-hidden="true" viewBox="0 0 16 16">
        <circle cx="6.8" cy="6.8" r="4.3" />
        <path d="m10 10 3.5 3.5" />
      </svg>
      <input
        ref={input}
        id="search"
        type="search"
        maxLength={200}
        defaultValue={value}
        placeholder={t('search')}
        aria-label={t('search')}
        autoComplete="off"
        onCompositionStart={() => {
          composing.current = true;
        }}
        onCompositionEnd={(event) => {
          composing.current = false;
          send({ type: 'search', value: event.currentTarget.value });
        }}
        onInput={(event) => {
          if (!composing.current) send({ type: 'search', value: event.currentTarget.value });
        }}
      />
    </div>
  );
}
