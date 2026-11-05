import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

/**
 * Server data for a screen: loads when the screen gains focus or deps change, and exposes
 * `refresh` for pull-to-refresh. Keeps showing the last data while reloading.
 */
export function useRemote<T>(query: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const run = useRef(0);

  // `query` is re-created every render; the caller's deps (as a key) decide when to refetch.
  const queryRef = useRef(query);
  useEffect(() => {
    queryRef.current = query;
  });
  const key = JSON.stringify(deps);

  const fetchNow = useCallback(async () => {
    const id = ++run.current;
    try {
      const d = await queryRef.current();
      if (id === run.current) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (id === run.current) setError(e instanceof Error ? e : new Error(String(e)));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchNow();
      // `key` is the trigger: refetch whenever the caller's deps change.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchNow, key]),
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNow();
    setRefreshing(false);
  }, [fetchNow]);

  return { data, error, loading: data === undefined && !error, refreshing, refresh, reload: fetchNow };
}
