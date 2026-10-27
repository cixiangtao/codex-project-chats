import { useEffect, useState } from 'react';

/** Advance relative labels only while visible; returning to the view catches up immediately. */
export function useVisibleClock() {
  const [clock, setClock] = useState(Date.now);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const schedule = () => {
      clearInterval(timer);
      if (!document.hidden) {
        setClock(Date.now());
        timer = setInterval(() => setClock(Date.now()), 60_000);
      }
    };
    document.addEventListener('visibilitychange', schedule);
    schedule();
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', schedule);
    };
  }, []);
  return clock;
}
