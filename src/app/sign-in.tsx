import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Ionicons, T } from '@/components/ui';
import { signInWithApple, signInWithGoogle } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/providers/AuthProvider';
import { colors, radius, space } from '@/theme';

export default function SignIn() {
  const { continueAsGuest } = useAuth();
  const [busy, setBusy] = useState<'google' | 'apple' | 'guest' | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  const run = async (kind: 'google' | 'apple' | 'guest', fn: () => Promise<unknown>) => {
    setBusy(kind);
    try {
      await fn();
    } catch (e) {
      Alert.alert('Sign-in failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.hero}>
        <View style={s.logo}>
          <Ionicons name="barbell" size={48} color="#fff" />
        </View>
        <T v="h1">Spark Lift</T>
        <T dim style={{ textAlign: 'center' }}>Log every set. See every PR.{'\n'}Your training, synced across devices.</T>
      </View>

      <View style={{ gap: space.md }}>
        {!isSupabaseConfigured && (
          <T v="small" color={colors.warning} style={{ textAlign: 'center' }}>
            Supabase isn&apos;t configured yet (.env.local). Sign-in is disabled — use guest mode.
          </T>
        )}
        <Button
          title="Continue with Google"
          icon="logo-google"
          loading={busy === 'google'}
          disabled={!isSupabaseConfigured || !!busy}
          onPress={() => run('google', signInWithGoogle)}
        />
        {appleAvailable && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={radius.md}
            style={{ height: 48, opacity: isSupabaseConfigured ? 1 : 0.4 }}
            onPress={() => isSupabaseConfigured && !busy && run('apple', signInWithApple)}
          />
        )}
        <Button
          title="Try without an account"
          variant="ghost"
          loading={busy === 'guest'}
          disabled={!!busy}
          onPress={() => run('guest', continueAsGuest)}
        />
        <T v="tiny" muted style={{ textAlign: 'center' }}>
          Guest data stays on this phone until you sign in.
        </T>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: space.xl, justifyContent: 'space-between' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  logo: { width: 96, height: 96, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
});
