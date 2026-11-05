import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/providers/AuthProvider';
import { importHealth } from './health';

const INTERVAL_MS = 30 * 60 * 1000;

/** Pulls today's steps from Health Connect / Apple Health on launch, on foreground and every 30 minutes. */
export function HealthManager() {
  const { userId } = useAuth();

  useEffect(() => {
    if (!userId) return;
    const run = () => importHealth(userId).catch((e) => console.warn('[health]', e));
    run();
    const appSub = AppState.addEventListener('change', (s) => s === 'active' && run());
    const interval = setInterval(run, INTERVAL_MS);
    return () => {
      appSub.remove();
      clearInterval(interval);
    };
  }, [userId]);

  return null;
}
