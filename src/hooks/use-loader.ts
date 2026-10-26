import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

/**
 * Loads data when the screen comes into focus, and again on reload().
 * The loader should throw on failure; the message ends up in `error`.
 * Pass a stable function (wrap it in useCallback) so it isn't re-run every render.
 */
export function useLoader<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await load());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return { data, error, loading, reload };
}
