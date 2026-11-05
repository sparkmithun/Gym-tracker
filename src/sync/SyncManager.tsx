import NetInfo from '@react-native-community/netinfo';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { updateProfile } from '@/features/profile/data';
import { useAuth } from '@/providers/AuthProvider';
import { setSyncUser, syncNow } from './sync';

const INTERVAL_MS = 5 * 60 * 1000;

function deviceTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** Keeps the local DB in sync: on foreground, on reconnect and every 5 minutes. */
export function SyncManager() {
  const { userId, isGuest, profile } = useAuth();
  const syncUserId = userId && !isGuest ? userId : null;

  // Leaderboards count points per local day, so the server needs this phone's time zone.
  useEffect(() => {
    if (!syncUserId || !profile) return;
    const zone = deviceTimeZone();
    if (zone && profile.timezone !== zone) updateProfile(syncUserId, { timezone: zone });
  }, [syncUserId, profile]);

  useEffect(() => {
    setSyncUser(syncUserId);
    if (!syncUserId) return;
    const run = () => syncNow(syncUserId).catch((e) => console.warn('[sync]', e));

    const appSub = AppState.addEventListener('change', (s) => s === 'active' && run());
    let wasOffline = false;
    const netUnsub = NetInfo.addEventListener((s) => {
      if (s.isConnected && wasOffline) run();
      wasOffline = s.isConnected === false;
    });
    const interval = setInterval(run, INTERVAL_MS);
    return () => {
      appSub.remove();
      netUnsub();
      clearInterval(interval);
    };
  }, [syncUserId]);

  return null;
}
