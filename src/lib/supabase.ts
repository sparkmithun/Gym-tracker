import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import Storage from 'expo-sqlite/kv-store';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** False until .env.local is filled in — the app then runs in local guest mode only. */
export const isSupabaseConfigured = url.startsWith('https://') && anonKey.length > 20;

export const supabase = createClient(
  isSupabaseConfigured ? url : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? anonKey : 'placeholder-anon-key',
  {
    auth: {
      storage: Storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
