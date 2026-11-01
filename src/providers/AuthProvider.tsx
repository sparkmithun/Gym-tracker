import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { clearUserData, db, initDb, kvGet, kvSet } from '@/db/client';
import { notifyChange, useLiveQuery } from '@/db/live';
import type { Profile } from '@/db/types';
import { signOutProviders } from '@/lib/auth';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useActiveWorkout } from '@/store/activeWorkout';
import { adoptGuestData, syncNow } from '@/sync/sync';
import { uuid } from '@/utils/uuid';

type AuthState = {
  ready: boolean;
  userId: string | null;
  isGuest: boolean;
  email: string | null;
  profile: Profile | null;
  needsOnboarding: boolean;
  continueAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/**
 * Shorthand for screens that only render when signed in. During sign-out a screen can render
 * once more before the redirect; '' then matches no rows instead of crashing.
 */
export function useUserId(): string {
  return useAuth().userId ?? '';
}

async function loadProfile(userId: string | null): Promise<Profile | null> {
  if (!userId) return null;
  const r = await db.getFirstAsync<Omit<Profile, 'is_private'> & { is_private: number }>('SELECT * FROM profiles WHERE id = ?', userId);
  return r ? { ...r, is_private: !!r.is_private } : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [dbReady, setDbReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionChecked, setSessionChecked] = useState(!isSupabaseConfigured);
  const [guestId, setGuestId] = useState<string | null>(null);

  useEffect(() => {
    initDb()
      .then(async () => {
        setGuestId(await kvGet('guest_user_id'));
        await useActiveWorkout.getState().hydrate();
      })
      .finally(() => setDbReady(true));
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const authUserId = session?.user.id ?? null;
  const userId = authUserId ?? guestId;

  // First sign-in on this device: adopt guest data, then pull everything from the server.
  useEffect(() => {
    if (!dbReady || !authUserId) return;
    (async () => {
      const previousGuest = await kvGet('guest_user_id');
      if (previousGuest) {
        await adoptGuestData(previousGuest, authUserId);
        await kvSet('guest_user_id', null);
        setGuestId(null);
      }
      await kvSet('signed_in_user_id', authUserId);
      await syncNow(authUserId).catch(() => undefined);
      notifyChange();
    })();
  }, [dbReady, authUserId]);

  const { data: profile } = useLiveQuery(() => loadProfile(dbReady ? userId : null), [dbReady, userId]);

  const continueAsGuest = useCallback(async () => {
    const id = uuid();
    await db.runAsync('INSERT OR IGNORE INTO profiles (id, display_name) VALUES (?, ?)', id, 'Guest');
    await kvSet('guest_user_id', id);
    setGuestId(id);
    notifyChange();
  }, []);

  const signOut = useCallback(async () => {
    if (authUserId) await syncNow(authUserId).catch(() => undefined);
    useActiveWorkout.getState().discard();
    await clearUserData();
    setGuestId(null);
    await signOutProviders();
    if (isSupabaseConfigured) await supabase.auth.signOut();
    notifyChange();
  }, [authUserId]);

  const deleteAccount = useCallback(async () => {
    if (authUserId) {
      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw error;
    }
    useActiveWorkout.getState().discard();
    await clearUserData();
    setGuestId(null);
    await signOutProviders();
    if (isSupabaseConfigured) await supabase.auth.signOut();
    notifyChange();
  }, [authUserId]);

  const ready = dbReady && sessionChecked && (userId === null || profile !== undefined);
  const value = useMemo<AuthState>(
    () => ({
      ready,
      userId,
      isGuest: !authUserId && !!guestId,
      email: session?.user.email ?? null,
      profile: profile ?? null,
      // A signed-in user whose profile hasn't been pulled yet also lands on onboarding,
      // which re-checks the server before asking for a username.
      needsOnboarding: !!userId && !profile?.username,
      continueAsGuest,
      signOut,
      deleteAccount,
    }),
    [ready, userId, authUserId, guestId, session, profile, continueAsGuest, signOut, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
