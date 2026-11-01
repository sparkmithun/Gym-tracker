import { useCallback, useEffect, useState, type DependencyList } from 'react';

// Tiny change-notification bus: every local write calls notifyChange(),
// every useLiveQuery re-runs. Plenty fast for one user's workout data.
const listeners = new Set<() => void>();

export function notifyChange() {
  listeners.forEach((l) => l());
}

export function useLiveQuery<T>(query: () => Promise<T>, deps: DependencyList) {
  const [state, setState] = useState<{ data: T | undefined; error: Error | null }>({ data: undefined, error: null });
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    listeners.add(refresh);
    return () => {
      listeners.delete(refresh);
    };
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    query().then(
      (data) => !cancelled && setState({ data, error: null }),
      (e: unknown) => !cancelled && setState((s) => ({ data: s.data, error: e instanceof Error ? e : new Error(String(e)) })),
    );
    return () => {
      cancelled = true;
    };
    // `query` is re-created every render; the caller's deps decide when it really changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  return { data: state.data, error: state.error, loading: state.data === undefined && !state.error, refresh };
}
