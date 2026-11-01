import { useEffect, useState } from 'react';

/** Current time in ms, re-rendering every `intervalMs` while `enabled` (0 = never tick). */
export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled || intervalMs <= 0) return;
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs, enabled]);
  return now;
}
