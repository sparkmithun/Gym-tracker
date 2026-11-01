import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Chip, Input, Row, T, styles } from '@/components/ui';
import { checkUsername, fetchServerProfile, updateProfile } from '@/features/profile/data';
import { useAuth } from '@/providers/AuthProvider';
import { colors, space } from '@/theme';

export default function Onboarding() {
  const { userId, isGuest, profile, email, signOut } = useAuth();
  const [checkingServer, setCheckingServer] = useState(!isGuest);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [unitWeight, setUnitWeight] = useState<'kg' | 'lbs'>(profile?.unit_weight ?? 'kg');
  const [unitDistance, setUnitDistance] = useState<'km' | 'mi'>(profile?.unit_distance ?? 'km');
  const [saving, setSaving] = useState(false);

  // A returning user may already have a username on the server — fetch it before asking.
  useEffect(() => {
    if (isGuest || !userId) return;
    fetchServerProfile(userId)
      .then((p) => {
        if (p?.display_name) setDisplayName(p.display_name);
        if (!p?.username && email) setUsername(email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20));
      })
      .finally(() => setCheckingServer(false));
  }, [userId, isGuest, email]);

  const save = async () => {
    if (!userId) return;
    const name = username.trim().toLowerCase();
    setSaving(true);
    try {
      const check = await checkUsername(userId, name, isGuest);
      if (check === 'invalid') return Alert.alert('Username', 'Use 3–20 characters: lowercase letters, numbers or _.');
      if (check === 'taken') return Alert.alert('Username', 'That username is taken. Try another.');
      if (check === 'offline') return Alert.alert('Offline', 'Connect to the internet to choose a username.');
      await updateProfile(userId, {
        username: name,
        display_name: displayName.trim() || name,
        unit_weight: unitWeight,
        unit_distance: unitDistance,
      });
    } finally {
      setSaving(false);
    }
  };

  if (checkingServer) return <View style={styles.screen} />;

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.content, { gap: space.lg }]} keyboardShouldPersistTaps="handled">
          <T v="h1">Welcome 👋</T>
          <T dim>Set up your profile. You can change all of this later in Settings.</T>
          <Input label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" autoCorrect={false} placeholder="e.g. mithun_lifts" maxLength={20} />
          <Input label="Display name" value={displayName} onChangeText={setDisplayName} placeholder="Your name" maxLength={50} />
          <View style={{ gap: space.sm }}>
            <T v="small" dim>Weight unit</T>
            <Row>
              <Chip label="Kilograms (kg)" active={unitWeight === 'kg'} onPress={() => setUnitWeight('kg')} />
              <Chip label="Pounds (lbs)" active={unitWeight === 'lbs'} onPress={() => setUnitWeight('lbs')} />
            </Row>
          </View>
          <View style={{ gap: space.sm }}>
            <T v="small" dim>Distance unit</T>
            <Row>
              <Chip label="Kilometres" active={unitDistance === 'km'} onPress={() => setUnitDistance('km')} />
              <Chip label="Miles" active={unitDistance === 'mi'} onPress={() => setUnitDistance('mi')} />
            </Row>
          </View>
          <Button title="Get started" onPress={save} loading={saving} disabled={username.trim().length < 3} />
          <Button title="Sign out" variant="ghost" onPress={signOut} />
          {isGuest && <T v="small" color={colors.textMuted}>Guest profile — stored only on this device.</T>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
